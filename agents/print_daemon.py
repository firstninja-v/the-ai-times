#!/usr/bin/env python3
"""
The AI Times — hands-free global print daemon.

Discovers local/CUPS/IPP printers, loads printer + paper profiles, and loops forever:
at each paper's printTime it queues and sends a print job without waiting for a click.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".ai-times"
PROFILES = DATA / "profiles"
PRINTERS = DATA / "printers.json"
QUEUE = DATA / "print-queue"
DONE = DATA / "print-done"
OUTPUT = DATA / "print-output"
STATE = DATA / "print-daemon-state.json"

API_BASE = os.environ.get("AI_TIMES_API", "http://127.0.0.1:43123")
POLL_SECONDS = int(os.environ.get("AI_TIMES_PRINT_POLL", "30"))


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text("utf-8"))
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), "utf-8")


def discover_printers() -> list[dict]:
    printers = []
    seen: set[str] = set()
    if shutil.which("lpstat"):
        try:
            out = subprocess.check_output(["lpstat", "-p", "-d"], text=True, stderr=subprocess.DEVNULL)
            default = None
            for line in out.splitlines():
                if line.startswith("system default destination:"):
                    default = line.split(":", 1)[1].strip()
                if line.startswith("printer "):
                    name = line.split()[1]
                    seen.add(name)
                    printers.append(
                        {
                            "id": name,
                            "name": name,
                            "driver": "cups",
                            "transport": "local",
                            "isDefault": name == default,
                            "supportsColor": True,
                            "paperSizes": ["A4", "Letter", "Tabloid"],
                            "duplex": True,
                            "status": "idle" if "is idle" in line or "idle" in line else "unknown",
                        }
                    )
        except subprocess.CalledProcessError:
            pass

    # Wi‑Fi / AirPrint discovery on the LAN
    try:
        from agents.newspaper.wifi_print import discover_wifi_printers

        for wifi in discover_wifi_printers(timeout=2.5):
            if wifi["id"] in seen:
                # Merge URI onto existing CUPS queue when names match
                for p in printers:
                    if p["id"] == wifi["id"]:
                        p.update({k: v for k, v in wifi.items() if k not in {"isDefault"}})
                        p["transport"] = "wifi"
                continue
            seen.add(wifi["id"])
            printers.append({**wifi, "isDefault": False})
    except Exception as exc:  # noqa: BLE001
        print(f"[print] wifi discover skipped: {exc}")

    # Always include a virtual printer so the loop works everywhere.
    printers.append(
        {
            "id": "ai-times-pdf",
            "name": "AI Times PDF (universal fallback)",
            "driver": "file",
            "transport": "file",
            "isDefault": not any(p.get("isDefault") for p in printers),
            "supportsColor": True,
            "paperSizes": ["A4", "Letter", "Tabloid"],
            "duplex": True,
            "status": "ready",
        }
    )

    # Optional network IPP printers from env: IPP_PRINTERS=name|ipp://host/printers/x,name2|ipp://...
    raw = os.environ.get("IPP_PRINTERS", "").strip()
    if raw:
        for chunk in raw.split(","):
            if "|" not in chunk:
                continue
            name, uri = chunk.split("|", 1)
            qid = name.strip().replace(" ", "-")
            if qid in seen:
                continue
            printers.append(
                {
                    "id": qid,
                    "name": name.strip(),
                    "driver": "ipp",
                    "transport": "wifi",
                    "uri": uri.strip(),
                    "isDefault": False,
                    "supportsColor": True,
                    "paperSizes": ["A4", "Letter", "Tabloid"],
                    "duplex": True,
                    "status": "configured",
                }
            )
    return printers


def sync_printer_registry() -> list[dict]:
    discovered = discover_printers()
    existing = load_json(PRINTERS, {"printers": []})
    by_id = {p["id"]: p for p in existing.get("printers", [])}
    for printer in discovered:
        prev = by_id.get(printer["id"], {})
        by_id[printer["id"]] = {
            **printer,
            "settings": prev.get("settings")
            or {
                "paperSize": "A4",
                "colorMode": "bw",
                "duplex": False,
                "copies": 1,
                "orientation": "portrait",
                "autoPrint": True,
            },
        }
    printers = list(by_id.values())
    save_json(
        PRINTERS,
        {
            "updatedAt": datetime.now().isoformat(),
            "count": len(printers),
            "printers": printers,
        },
    )
    return printers


def due_now(hhmm: str, tz_name: str) -> bool:
    try:
        tz = ZoneInfo(tz_name) if tz_name else ZoneInfo("UTC")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("UTC")
    now = datetime.now(tz)
    try:
        hour, minute = [int(x) for x in hhmm.split(":")]
    except ValueError:
        return False
    return now.hour == hour and now.minute == minute


def request_edition(profile: dict) -> dict | None:
    payload = {
        "name": profile.get("companyName") or profile.get("name") or "Reader",
        "titleStyle": profile.get("titleStyle", "the-times"),
        "customTitle": profile.get("customTitle"),
        "interests": profile.get("interests") or ["business", "technology", "world"],
        "colorMode": profile.get("colorMode", "bw"),
        "pageCount": profile.get("pageCount", "auto"),
        "company": {
            "companyName": profile.get("companyName"),
            "keywords": profile.get("keywords") or [],
            "industry": profile.get("industry"),
        },
    }
    req = urllib.request.Request(
        f"{API_BASE}/api/edition",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("edition")
    except urllib.error.URLError as exc:
        print(f"[print] edition fetch failed: {exc}")
        return None


def render_html(edition: dict, settings: dict) -> str:
    color_filter = "filter:grayscale(1);" if settings.get("colorMode") == "bw" else ""
    pages = []
    for page in edition.get("pages", []):
        sections_html = []
        for section in page.get("sections", []):
            articles = "".join(
                f"<article style='margin:0 0 18px;break-inside:avoid;'>"
                f"<div style='font:10px monospace;letter-spacing:.14em;text-transform:uppercase;color:#888'>{a.get('category','')}</div>"
                f"<h2 style='margin:6px 0;font:700 22px/1.2 Georgia,serif'>{escape(a.get('title',''))}</h2>"
                f"<p style='margin:0;font:14px/1.5 Georgia,serif'>{escape(a.get('summary',''))}</p>"
                f"</article>"
                for a in section.get("articles", [])
            )
            sections_html.append(articles)
        pages.append(
            f"<section style='page-break-after:always;padding:24px'>"
            f"<h1 style='font:700 36px Georgia,serif;text-align:center'>{escape(edition.get('paperTitle',''))}</h1>"
            f"<div style='text-align:center;color:#666;margin:8px 0 18px'>{escape(edition.get('dateLabel',''))} · Page {page.get('number')}</div>"
            f"{''.join(sections_html)}</section>"
        )
    paper = settings.get("paperSize", "A4")
    return (
        "<!doctype html><html><head><meta charset='utf-8'/>"
        f"<style>@page{{size:{paper} portrait;margin:10mm}} "
        "body{margin:0;font:10.5pt/1.35 Georgia,serif}"
        f"{color_filter}</style>"
        "</head><body>" + "".join(pages) + "</body></html>"
    )


def escape(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def send_to_printer(html_path: Path, printer: dict, settings: dict) -> str:
    driver = printer.get("driver")
    if driver == "ipp" or printer.get("transport") == "wifi" or printer.get("uri"):
        try:
            from agents.newspaper.wifi_print import send_wifi_print

            result = send_wifi_print(
                html_path,
                printer,
                copies=int(settings.get("copies", 1) or 1),
                media=str(settings.get("paperSize") or "A4"),
            )
            return str(result.get("mode") or "wifi-ipp")
        except Exception as exc:  # noqa: BLE001
            print(f"[print] wifi send failed: {exc}")
            return "wifi-error"
    if driver == "cups" and shutil.which("lp"):
        cmd = ["lp", "-d", printer["id"], "-n", str(settings.get("copies", 1))]
        if settings.get("duplex"):
            cmd += ["-o", "sides=two-sided-long-edge"]
        if settings.get("colorMode") == "bw":
            cmd += ["-o", "ColorModel=Gray"]
        cmd += ["-o", f"media={settings.get('paperSize', 'A4')}", str(html_path)]
        subprocess.run(cmd, check=False)
        return "cups"
    return "file"


def process_profile(profile_path: Path, printers: list[dict], state: dict) -> None:
    profile = load_json(profile_path, {})
    if not profile.get("printEnabled", True):
        return
    print_time = profile.get("printTime") or "07:05"
    tz = profile.get("timezone") or "UTC"
    day_key = datetime.now().strftime("%Y-%m-%d")
    stamp_key = f"{profile_path.stem}:{day_key}:{print_time}"
    printed = set(state.get("printedKeys") or [])
    if stamp_key in printed:
        return
    if not due_now(print_time, tz):
        return

    print(f"[print] due · {profile_path.stem} at {print_time} ({tz})")
    edition = request_edition(profile)
    if not edition:
        return

    printer_id = profile.get("printerId") or next(
        (p["id"] for p in printers if p.get("isDefault")), printers[0]["id"]
    )
    printer = next((p for p in printers if p["id"] == printer_id), printers[-1])
    settings = {
        **(printer.get("settings") or {}),
        "colorMode": profile.get("colorMode") or (printer.get("settings") or {}).get("colorMode", "bw"),
    }

    OUTPUT.mkdir(parents=True, exist_ok=True)
    QUEUE.mkdir(parents=True, exist_ok=True)
    html = render_html(edition, settings)
    out = OUTPUT / f"{profile_path.stem}-{day_key}.html"
    out.write_text(html, "utf-8")
    job = {
        "queuedAt": datetime.now().isoformat(),
        "profile": profile_path.stem,
        "printerId": printer["id"],
        "settings": settings,
        "edition": edition,
        "auto": True,
    }
    job_path = QUEUE / f"auto-{profile_path.stem}-{int(time.time())}.json"
    save_json(job_path, job)
    mode = send_to_printer(out, printer, settings)
    DONE.mkdir(parents=True, exist_ok=True)
    job_path.rename(DONE / job_path.name)
    printed.add(stamp_key)
    state["printedKeys"] = list(printed)[-500:]
    state["lastPrintAt"] = datetime.now().isoformat()
    state["lastPrinter"] = printer["id"]
    state["lastMode"] = mode
    print(f"[print] sent via {mode} → {printer['name']} · {out}")


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    PROFILES.mkdir(parents=True, exist_ok=True)
    print("[print] The AI Times print daemon online")
    while True:
        printers = sync_printer_registry()
        state = load_json(STATE, {"printedKeys": []})
        profiles = list(PROFILES.glob("*.json"))
        if not profiles:
            # fallback personal profile export if UI saved one via API
            personal = DATA / "personal-profile.json"
            if personal.exists():
                profiles = [personal]
        for path in profiles:
            try:
                process_profile(path, printers, state)
            except Exception as exc:  # noqa: BLE001
                print(f"[print] profile {path.name} error: {exc}")
        save_json(STATE, state)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
