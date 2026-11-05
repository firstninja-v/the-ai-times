"""
Wi‑Fi / network printer support for The AI Times.

- Discover AirPrint / IPP printers on the LAN (Avahi / Zeroconf)
- Register them with CUPS so everyday `lp` jobs work
- Convert A4 HTML → PDF via headless Chrome
- Send jobs over IPP/CUPS to the connected home/office printer
"""

from __future__ import annotations

import re
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]


def _safe_queue_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip()).strip("-").lower()
    return (slug or "wifi-printer")[:40]


def normalize_ipp_uri(uri: str) -> str:
    uri = (uri or "").strip()
    if not uri:
        return uri
    # Accept bare host → AirPrint-ish default path
    if "://" not in uri:
        if uri.count(".") >= 1 or uri.endswith(".local"):
            return f"ipp://{uri}/ipp/print"
        return uri
    parsed = urlparse(uri)
    if parsed.scheme in {"http", "https"} and "/ipp" not in (parsed.path or ""):
        # Common mistake: pasting http://printer.local — map to ipp
        host = parsed.hostname or ""
        port = f":{parsed.port}" if parsed.port else ""
        path = parsed.path if parsed.path and parsed.path != "/" else "/ipp/print"
        scheme = "ipps" if parsed.scheme == "https" else "ipp"
        return f"{scheme}://{host}{port}{path}"
    if parsed.scheme in {"ipp", "ipps"} and (not parsed.path or parsed.path == "/"):
        return f"{uri.rstrip('/')}/ipp/print"
    return uri


def discover_wifi_printers(timeout: float = 3.0) -> list[dict]:
    """Browse the LAN for IPP / AirPrint Wi‑Fi printers."""
    found: dict[str, dict] = {}

    # 1) Avahi (fast when daemon is up)
    if shutil.which("avahi-browse"):
        try:
            out = subprocess.check_output(
                ["avahi-browse", "-atrp", "_ipp._tcp", "_ipps._tcp", "_printer._tcp"],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=max(4.0, timeout + 2),
            )
            for line in out.splitlines():
                # =;iface;proto;name;type;domain;host;ip;port;txt
                if not line.startswith("="):
                    continue
                parts = line.split(";")
                if len(parts) < 9:
                    continue
                name, service, host, ip, port = parts[3], parts[4], parts[6], parts[7], parts[8]
                scheme = "ipps" if "ipps" in service else "ipp"
                path = "/ipp/print"
                # txt may include rp=...
                txt = parts[9] if len(parts) > 9 else ""
                for chunk in txt.split(" "):
                    if chunk.startswith("rp="):
                        rp = chunk.split("=", 1)[1].strip()
                        if rp:
                            path = "/" + rp.lstrip("/")
                uri = f"{scheme}://{ip}:{port}{path}"
                qid = _safe_queue_name(name)
                found[qid] = {
                    "id": qid,
                    "name": name or qid,
                    "driver": "ipp",
                    "transport": "wifi",
                    "uri": uri,
                    "host": host,
                    "ip": ip,
                    "port": int(port) if str(port).isdigit() else None,
                    "status": "discovered",
                    "supportsColor": True,
                    "paperSizes": ["A4", "Letter", "Tabloid"],
                    "duplex": True,
                }
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            pass

    # 2) Zeroconf fallback
    if not found:
        try:
            from zeroconf import ServiceBrowser, Zeroconf  # type: ignore

            class _Collector:
                def __init__(self) -> None:
                    self.items: list[dict] = []

                def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                    info = zc.get_service_info(type_, name)
                    if not info or not info.addresses:
                        return
                    ip = socket.inet_ntoa(info.addresses[0])
                    props = {
                        (k.decode() if isinstance(k, bytes) else k): (
                            v.decode() if isinstance(v, bytes) else v
                        )
                        for k, v in (info.properties or {}).items()
                    }
                    rp = props.get("rp") or "ipp/print"
                    scheme = "ipps" if "ipps" in type_ else "ipp"
                    uri = f"{scheme}://{ip}:{info.port}/{str(rp).lstrip('/')}"
                    nice = name.split(".")[0]
                    qid = _safe_queue_name(nice)
                    self.items.append(
                        {
                            "id": qid,
                            "name": nice,
                            "driver": "ipp",
                            "transport": "wifi",
                            "uri": uri,
                            "ip": ip,
                            "port": info.port,
                            "status": "discovered",
                            "supportsColor": True,
                            "paperSizes": ["A4", "Letter", "Tabloid"],
                            "duplex": True,
                        }
                    )

                def remove_service(self, *args) -> None:  # noqa: ANN002
                    return None

                def update_service(self, *args) -> None:  # noqa: ANN002
                    return None

            zc = Zeroconf()
            collector = _Collector()
            browsers = [
                ServiceBrowser(zc, t, collector)
                for t in ("_ipp._tcp.local.", "_ipps._tcp.local.", "_printer._tcp.local.")
            ]
            time.sleep(timeout)
            for b in browsers:
                b.cancel()
            zc.close()
            for item in collector.items:
                found[item["id"]] = item
        except Exception:  # noqa: BLE001
            pass

    return list(found.values())


def register_cups_ipp(name: str, uri: str) -> dict:
    """Create/update a CUPS queue that points at a Wi‑Fi IPP printer."""
    uri = normalize_ipp_uri(uri)
    queue = _safe_queue_name(name)
    if not shutil.which("lpadmin"):
        return {
            "ok": False,
            "id": queue,
            "name": name,
            "uri": uri,
            "driver": "ipp",
            "transport": "wifi",
            "error": "lpadmin not installed — saved IPP URI only; install cups-client for full Wi‑Fi print",
        }

    # Prefer everywhere / driverless for AirPrint-class devices.
    # Try without sudo first, then sudo -n for headless agents.
    base_cmds = [
        ["lpadmin", "-p", queue, "-E", "-v", uri, "-m", "everywhere"],
        ["lpadmin", "-p", queue, "-E", "-v", uri, "-m", "drvless.ppd"],
    ]
    last_err = ""
    for base in base_cmds:
        for prefix in ([], ["sudo", "-n"]):
            cmd = [*prefix, *base]
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                for follow in (
                    ["cupsenable", queue],
                    ["cupsaccept", queue],
                    ["sudo", "-n", "cupsenable", queue],
                    ["sudo", "-n", "cupsaccept", queue],
                ):
                    subprocess.run(follow, check=False, capture_output=True)
                return {
                    "ok": True,
                    "id": queue,
                    "name": name,
                    "uri": uri,
                    "driver": "ipp",
                    "transport": "wifi",
                    "cupsQueue": queue,
                    "status": "ready",
                }
            except subprocess.CalledProcessError as exc:
                last_err = (exc.stderr or exc.stdout or str(exc))[:400]

    # Still save as Wi‑Fi IPP — send_wifi_print can lp to URI via temporary queue later
    return {
        "ok": False,
        "id": queue,
        "name": name,
        "uri": uri,
        "driver": "ipp",
        "transport": "wifi",
        "error": last_err or "lpadmin failed",
        "status": "configured",
    }


def html_to_pdf(html_path: Path, pdf_path: Path | None = None) -> Path:
    """Render A4 PDF from the edition HTML using headless Chrome."""
    html_path = Path(html_path)
    pdf_path = Path(pdf_path or html_path.with_suffix(".pdf"))
    chrome = (
        shutil.which("google-chrome")
        or shutil.which("chromium")
        or shutil.which("chromium-browser")
        or "/usr/local/bin/google-chrome"
    )
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        f"--print-to-pdf={pdf_path}",
        f"file://{html_path.resolve()}",
    ]
    subprocess.run(cmd, check=False, capture_output=True, timeout=90)
    if not pdf_path.exists() or pdf_path.stat().st_size < 500:
        # Fallback: keep HTML path and let CUPS guess
        return html_path
    return pdf_path


def send_wifi_print(html_path: Path, printer: dict, *, copies: int = 1, media: str = "A4") -> dict:
    """Send an edition to a Wi‑Fi/IPP printer (via CUPS queue when possible)."""
    html_path = Path(html_path)
    uri = normalize_ipp_uri(printer.get("uri") or "")
    queue = printer.get("cupsQueue") or printer.get("id")
    name = printer.get("name") or queue

    # Ensure CUPS knows this Wi‑Fi printer
    if uri and shutil.which("lpadmin"):
        reg = register_cups_ipp(str(name), uri)
        if reg.get("ok"):
            queue = reg["id"]
            printer = {**printer, **reg}

    printable = html_to_pdf(html_path)

    # 1) Named CUPS queue
    if shutil.which("lp") and queue:
        cmd = ["lp", "-d", str(queue), "-n", str(copies), "-o", f"media={media}"]
        if printable.suffix.lower() == ".pdf":
            cmd += ["-o", "document-format=application/pdf"]
        cmd.append(str(printable))
        completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
        if completed.returncode == 0:
            return {
                "mode": "wifi-ipp",
                "ok": True,
                "printer": queue,
                "printerName": name,
                "uri": uri or None,
                "file": str(printable),
                "lp": (completed.stdout or "").strip()[:300],
                "transport": "wifi",
            }

    # 2) Direct IPP Print-Job over Wi‑Fi (works without CUPS admin rights)
    if uri:
        direct = _ipp_print_http(uri, printable, job_name=f"AI-Times-{printable.stem}")
        if direct.get("ok"):
            return {
                "mode": "wifi-ipp-direct",
                "ok": True,
                "printer": queue,
                "printerName": name,
                "uri": uri,
                "file": str(printable),
                "transport": "wifi",
                "detail": direct,
            }
        return {
            "mode": "wifi-error",
            "ok": False,
            "printer": queue,
            "printerName": name,
            "uri": uri,
            "file": str(printable),
            "detail": direct,
            "hint": "Could not reach the Wi‑Fi printer. Check same Wi‑Fi/VPN, IPP URL, and that the printer is awake.",
            "transport": "wifi",
        }

    return {
        "mode": "file",
        "ok": False,
        "printer": queue,
        "printerName": name,
        "uri": uri or None,
        "file": str(printable),
        "hint": "CUPS client missing — saved printable file. Install cups-client for Wi‑Fi print.",
        "transport": "wifi",
    }


def _ipp_print_http(uri: str, file_path: Path, *, job_name: str = "AI Times") -> dict:
    """
    Minimal IPP Print-Job over HTTP(S) for Wi‑Fi printers that speak IPP.
    Good enough for many AirPrint / modern LAN printers when CUPS admin is locked down.
    """
    import struct

    import httpx

    uri = normalize_ipp_uri(uri)
    parsed = urlparse(uri)
    host = parsed.hostname
    if not host:
        return {"ok": False, "error": "bad uri"}
    port = parsed.port or (443 if parsed.scheme == "ipps" else 631)
    path = parsed.path or "/ipp/print"
    scheme = "https" if parsed.scheme == "ipps" else "http"
    url = f"{scheme}://{host}:{port}{path}"

    data = file_path.read_bytes()
    doc_format = b"application/pdf" if file_path.suffix.lower() == ".pdf" else b"text/html"

    def ipp_string(tag: int, name: bytes, value: bytes) -> bytes:
        return struct.pack(">B", tag) + struct.pack(">H", len(name)) + name + struct.pack(">H", len(value)) + value

    # IPP binary: version 1.1, operation Print-Job (0x0002), request id 1
    body = bytearray()
    body += struct.pack(">BBHH", 1, 1, 0x0002, 1)
    body += b"\x01"  # operation-attributes-tag
    body += ipp_string(0x47, b"attributes-charset", b"utf-8")
    body += ipp_string(0x48, b"attributes-natural-language", b"en")
    body += ipp_string(0x45, b"printer-uri", uri.encode())
    body += ipp_string(0x42, b"job-name", job_name.encode()[:64])
    body += ipp_string(0x49, b"document-format", doc_format)
    body += b"\x03"  # end-of-attributes
    body += data

    try:
        with httpx.Client(timeout=45.0, verify=False, follow_redirects=True) as client:
            res = client.post(
                url,
                content=bytes(body),
                headers={"Content-Type": "application/ipp", "Accept": "application/ipp"},
            )
        ok = res.status_code in {200, 201} and len(res.content) >= 8
        # IPP status code sits at bytes 2-3 of response
        status = None
        if len(res.content) >= 4:
            status = struct.unpack(">H", res.content[2:4])[0]
            ok = ok and status < 0x0400
        return {
            "ok": bool(ok),
            "http": res.status_code,
            "ippStatus": status,
            "url": url,
            "bytes": len(data),
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "url": url}


def probe_ipp(uri: str, timeout: float = 3.0) -> dict:
    """Lightweight reachability check for a Wi‑Fi printer URI."""
    uri = normalize_ipp_uri(uri)
    parsed = urlparse(uri)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "ipps" else 631)
    if not host:
        return {"ok": False, "uri": uri, "error": "invalid URI"}
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"ok": True, "uri": uri, "host": host, "port": port}
    except OSError as exc:
        return {"ok": False, "uri": uri, "host": host, "port": port, "error": str(exc)}
