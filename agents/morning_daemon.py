#!/usr/bin/env python3
"""
The AI Times — always-on morning agent.

Every day, for each saved profile:
  1. At emailTime → generate the designed A4 paper (Python studio) and email it
  2. At printTime → send the latest edition to the printer / PDF fallback

Runs forever alongside news + print daemons.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from agents.newspaper.generate import generate_edition  # noqa: E402
from agents.newspaper.emailer import send_edition_email  # noqa: E402
from agents.newspaper.config import EmailConfig  # noqa: E402

DATA = ROOT / ".ai-times"
PROFILES = DATA / "profiles"
STATE = DATA / "morning-daemon-state.json"
PUBLIC_EDITIONS = ROOT / "public" / "editions"
PRINT_OUTPUT = DATA / "print-output"
PRINTERS = DATA / "printers.json"
SETTINGS = DATA / "settings.json"
DELIVERY = DATA / "delivery.json"

POLL_SECONDS = int(os.environ.get("AI_TIMES_MORNING_POLL", "20"))


def delivery_state() -> dict:
    return load_json(
        DELIVERY,
        {
            "paused": False,
            "pauseMode": "print",
            "printerId": None,
            "printerName": None,
        },
    )


def apply_settings_env() -> None:
    """Push Settings UI SMTP into process env so EmailConfig picks it up."""
    settings = load_json(SETTINGS, {})
    email = settings.get("email") or {}
    if email.get("enabled") and email.get("host") and email.get("user") and email.get("pass"):
        if email.get("pass") == "••••••••":
            return
        os.environ["SMTP_HOST"] = str(email["host"])
        os.environ["SMTP_PORT"] = str(email.get("port") or 587)
        os.environ["SMTP_USER"] = str(email["user"])
        os.environ["SMTP_PASS"] = str(email["pass"])
        os.environ["SMTP_FROM"] = str(email.get("from") or email["user"])
        os.environ["SMTP_SECURE"] = "true" if email.get("secure") else "false"


def sync_agents_into_profiles() -> None:
    """Mirror delivery agents from Settings into profile files the loop already watches."""
    settings = load_json(SETTINGS, {})
    agents = [a for a in (settings.get("agents") or []) if a.get("enabled", True)]
    if not agents:
        return
    PROFILES.mkdir(parents=True, exist_ok=True)
    for agent in agents:
        stem = re_slug(agent.get("name") or agent.get("id") or "agent")
        path = PROFILES / f"{stem}.json"
        existing = load_json(path, {})
        # Prefer personal profile as base when present
        personal = load_json(DATA / "personal-profile.json", {})
        base = existing or personal or {
            "kind": "personal",
            "name": agent.get("name") or "Reader",
            "email": os.getenv("NEWSPAPER_EMAIL_TO", personal.get("email") or "reader@theaitimes.local"),
            "titleStyle": "the-times",
            "interests": ["technology", "world", "business"],
            "newsPrompt": "Useful morning coverage. Skip celebrity gossip.",
            "colorMode": "bw",
            "preferredFont": "georgia",
            "preferredTemplate": "classic",
            "pageCount": 4,
            "breakingNews": True,
            "puzzles": ["crossword", "sudoku", "wordsearch", "trivia", "nonogram"],
            "contentVolume": "more",
        }
        merged = {
            **base,
            "emailTime": agent.get("emailTime") or base.get("emailTime") or "06:00",
            "printTime": agent.get("printTime") or base.get("printTime") or "06:05",
            "printEnabled": bool(agent.get("printEnabled", True)),
            "printerId": agent.get("printerId") or base.get("printerId"),
            "timezone": agent.get("timezone") or base.get("timezone") or "America/New_York",
            "deliveryAgentId": agent.get("id"),
        }
        save_json(path, merged)


def re_slug(value: str) -> str:
    import re

    slug = re.sub(r"[^a-zA-Z0-9]+", "-", str(value).lower()).strip("-")
    return slug[:48] or "agent"


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


def due_now(hhmm: str, tz_name: str, window_minutes: int = 1) -> bool:
    try:
        tz = ZoneInfo(tz_name) if tz_name else ZoneInfo("UTC")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("UTC")
    now = datetime.now(tz)
    try:
        hour, minute = [int(x) for x in str(hhmm).split(":")]
    except ValueError:
        return False
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    delta = abs((now - target).total_seconds())
    return delta < window_minutes * 60


def paper_title_for(profile: dict) -> str:
    if profile.get("customTitle"):
        return profile["customTitle"]
    company = (profile.get("company") or {}).get("companyName")
    if profile.get("kind") == "company" and company:
        return f"The {company} Times"
    name = profile.get("name") or "Reader"
    style = profile.get("titleStyle") or "the-times"
    mapping = {
        "the-times": f"The {name} Times",
        "daily-news": f"{name}'s Daily News",
        "the-herald": f"The {name} Herald",
        "morning-edition": f"{name} Morning Edition",
        "the-post": f"The {name} Post",
        "custom": profile.get("customTitle") or f"The {name} Times",
    }
    return mapping.get(style, f"The {name} Times")


def profile_paths() -> list[Path]:
    PROFILES.mkdir(parents=True, exist_ok=True)
    paths = sorted(PROFILES.glob("*.json"))
    personal = DATA / "personal-profile.json"
    if personal.exists() and personal not in paths:
        paths.append(personal)
    return paths


def generate_for_profile(profile: dict) -> dict:
    pages = profile.get("pageCount", 4)
    if pages == "auto" or not pages:
        pages = 4
    pages = int(pages)
    template = profile.get("preferredTemplate") or os.getenv("NEWSPAPER_TEMPLATE", "classic")
    font = profile.get("preferredFont") or os.getenv("NEWSPAPER_FONT", "georgia")
    color_mode = profile.get("colorMode") or "bw"
    use_llm = bool((profile.get("byok") or {}).get("enabled") and (profile.get("byok") or {}).get("apiKey"))

    # Inject BYOK into env for this generation.
    byok = profile.get("byok") or {}
    if byok.get("enabled") and byok.get("apiKey"):
        os.environ["LLM_API_KEY"] = byok["apiKey"]
        if byok.get("baseUrl"):
            os.environ["LLM_BASE_URL"] = byok["baseUrl"]
        if byok.get("model"):
            os.environ["LLM_MODEL"] = byok["model"]

    puzzle_kinds = profile.get("puzzles")
    if puzzle_kinds is None:
        puzzle_kinds = ["crossword", "sudoku", "wordsearch"]
    puzzle_difficulty = profile.get("puzzleDifficulty") or "medium"
    content_volume = profile.get("contentVolume") or "more"

    result = generate_edition(
        template=template,
        paper_title=paper_title_for(profile),
        pages=pages,
        max_articles=max(14, pages * 5),
        company=(profile.get("company") or {}).get("companyName"),
        use_llm=use_llm,
        email_to=None,
        news_prompt=profile.get("newsPrompt"),
        font=font,
        color_mode=color_mode,
        puzzles=list(puzzle_kinds),
        puzzle_difficulty=puzzle_difficulty,
        include_puzzles=bool(puzzle_kinds),
        content_volume=content_volume,
    )
    return result


def email_result(profile: dict, result: dict) -> dict:
    to_email = profile.get("email")
    if not to_email:
        return {"mode": "skipped", "reason": "no email"}
    html_path = Path(result["html"])
    return send_edition_email(
        to_email=to_email,
        subject=f"{result.get('paper_title') or 'The AI Times'} — morning edition",
        html_path=html_path,
        config=EmailConfig(),
    )


def print_latest(profile: dict, result: dict | None = None, *, force: bool = False) -> dict:
    delivery = delivery_state()
    if (
        not force
        and delivery.get("paused")
        and delivery.get("pauseMode", "print") in {"print", "all"}
    ):
        return {
            "mode": "paused",
            "reason": "printing paused — resume from Daily agent when you’re home",
            "printer": delivery.get("printerId"),
        }

    PRINT_OUTPUT.mkdir(parents=True, exist_ok=True)
    src = Path(result["html"]) if result and result.get("html") else PUBLIC_EDITIONS / "latest.html"
    if not src.exists():
        return {"mode": "skipped", "reason": "no edition file"}

    day = datetime.now().strftime("%Y-%m-%d")
    out = PRINT_OUTPUT / f"{profile.get('name', 'reader').replace(' ', '-').lower()}-{day}-a4.html"
    # Ensure A4 @page is present for CUPS/PDF consumers.
    html = src.read_text("utf-8")
    if "@page" not in html:
        html = html.replace(
            "</head>",
            "<style>@page{size:A4 portrait;margin:10mm}</style></head>",
            1,
        )
    out.write_text(html, "utf-8")

    printers = load_json(PRINTERS, {"printers": []}).get("printers") or []
    # Prefer the once-connected home/office printer from delivery state.
    printer_id = delivery.get("printerId") or profile.get("printerId")
    printer = next((p for p in printers if p.get("id") == printer_id), None)
    if not printer:
        printer = next((p for p in printers if p.get("isDefault") or p.get("connected")), None) or {
            "id": "ai-times-pdf",
            "name": "AI Times PDF",
            "driver": "file",
        }

    settings = {
        **(printer.get("settings") or {}),
        "paperSize": "A4",
        "colorMode": profile.get("colorMode") or "bw",
        "copies": (printer.get("settings") or {}).get("copies", 1),
    }

    driver = printer.get("driver")
    transport = printer.get("transport") or ("wifi" if driver == "ipp" or printer.get("uri") else "local")

    # Wi‑Fi / IPP network printers (AirPrint, office LAN, etc.)
    if driver == "ipp" or transport == "wifi" or printer.get("uri"):
        from agents.newspaper.wifi_print import send_wifi_print

        sent = send_wifi_print(
            out,
            printer,
            copies=int(settings.get("copies", 1) or 1),
            media=str(settings.get("paperSize") or "A4"),
        )
        return {**sent, "sourceHtml": str(out)}

    if driver == "cups" and shutil.which("lp"):
        cmd = [
            "lp",
            "-d",
            printer["id"],
            "-n",
            str(settings.get("copies", 1)),
            "-o",
            "media=A4",
        ]
        if settings.get("colorMode") == "bw":
            cmd += ["-o", "ColorModel=Gray"]
        cmd.append(str(out))
        completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
        return {
            "mode": "cups",
            "printer": printer["id"],
            "printerName": printer.get("name"),
            "file": str(out),
            "lp": (completed.stdout or completed.stderr or "").strip()[:240],
        }

    # Universal fallback: leave A4 HTML ready for any local printer UI / CUPS later.
    return {
        "mode": "file",
        "printer": printer.get("id"),
        "printerName": printer.get("name"),
        "file": str(out),
        "hint": "No CUPS/IPP driver for this printer yet — connect a Wi‑Fi or USB printer in Daily agent.",
    }


def process_profile(path: Path, state: dict) -> None:
    profile = load_json(path, {})
    if not profile:
        return

    delivery = delivery_state()
    # Prefer the once-connected printer for every profile run.
    if delivery.get("printerId"):
        profile = {**profile, "printerId": delivery["printerId"], "printEnabled": True}

    tz = profile.get("timezone") or "UTC"
    day = datetime.now().strftime("%Y-%m-%d")
    email_time = profile.get("emailTime") or "06:00"
    print_time = profile.get("printTime") or "06:05"
    stem = path.stem

    emailed_key = f"email:{stem}:{day}:{email_time}"
    printed_key = f"print:{stem}:{day}:{print_time}"
    done = set(state.get("doneKeys") or [])
    paused_all = bool(delivery.get("paused") and delivery.get("pauseMode") == "all")
    paused_print = bool(delivery.get("paused") and delivery.get("pauseMode", "print") == "print")

    if paused_all:
        state["paused"] = True
        state["pauseMode"] = "all"
        state["updatedAt"] = datetime.now().isoformat()
        return

    # Morning generate + email
    if emailed_key not in done and due_now(email_time, tz):
        print(f"[morning] generate+email · {stem} @ {email_time} ({tz})")
        try:
            result = generate_for_profile(profile)
            mail = email_result(profile, result)
            state["lastGenerate"] = result
            state["lastEmail"] = mail
            state["lastEditionHtml"] = result.get("html")
            done.add(emailed_key)
            print(f"[morning] emailed ({mail.get('mode')}) → {profile.get('email')} · {result.get('publicUrl')}")
        except Exception as exc:  # noqa: BLE001
            print(f"[morning] generate/email failed for {stem}: {exc}")

    # Print pass — reuse today's generation when possible
    if profile.get("printEnabled", True) and printed_key not in done and due_now(print_time, tz):
        if paused_print:
            print(f"[morning] print paused · {stem} (away from home) — skipping hardware print")
            state["lastPrint"] = {
                "mode": "paused",
                "reason": "paused while away",
                "printer": delivery.get("printerId"),
            }
            done.add(printed_key)
        else:
            print(f"[morning] print · {stem} @ {print_time} ({tz}) → {profile.get('printerId')}")
            try:
                result = state.get("lastGenerate")
                html = Path(str((result or {}).get("html") or ""))
                if not result or not html.exists():
                    result = generate_for_profile(profile)
                    state["lastGenerate"] = result
                    if emailed_key not in done:
                        mail = email_result(profile, result)
                        state["lastEmail"] = mail
                        done.add(emailed_key)
                printed = print_latest(profile, result)
                state["lastPrint"] = printed
                done.add(printed_key)
                print(f"[morning] print via {printed.get('mode')} → {printed.get('file')}")
            except Exception as exc:  # noqa: BLE001
                print(f"[morning] print failed for {stem}: {exc}")

    state["paused"] = bool(delivery.get("paused"))
    state["pauseMode"] = delivery.get("pauseMode")
    state["connectedPrinter"] = delivery.get("printerId")
    state["doneKeys"] = list(done)[-800:]
    state["updatedAt"] = datetime.now().isoformat()


def run_once_force(profile_path: Path | None = None) -> None:
    """Manual smoke: generate + email + print immediately for one/all profiles."""
    state = load_json(STATE, {"doneKeys": []})
    paths = [profile_path] if profile_path else profile_paths()
    if not paths:
        # Seed a demo profile so the loop is useful out of the box.
        demo = {
            "kind": "personal",
            "name": "Reader",
            "email": os.getenv("NEWSPAPER_EMAIL_TO", "reader@theaitimes.local"),
            "titleStyle": "the-times",
            "interests": ["technology", "world", "business"],
            "newsPrompt": "Useful morning coverage on AI, markets, and world affairs.",
            "colorMode": "bw",
            "preferredFont": "georgia",
            "preferredTemplate": "classic",
            "emailTime": "06:00",
            "printEnabled": True,
            "printTime": "06:05",
            "timezone": os.getenv("TZ", "America/New_York"),
            "pageCount": 4,
            "breakingNews": True,
        }
        PROFILES.mkdir(parents=True, exist_ok=True)
        demo_path = PROFILES / "reader.json"
        save_json(demo_path, demo)
        paths = [demo_path]
        print(f"[morning] seeded demo profile → {demo_path}")

    for path in paths:
        profile = load_json(path, {})
        print(f"[morning] force run · {path.name}")
        result = generate_for_profile(profile)
        mail = email_result(profile, result)
        printed = print_latest(profile, result)
        print(json.dumps({"profile": path.name, "result": result, "email": mail, "print": printed}, indent=2))
        state["lastGenerate"] = result
        state["lastEmail"] = mail
        state["lastPrint"] = printed
    save_json(STATE, state)


def main(argv: list[str] | None = None) -> int:
    argv = list(argv or sys.argv[1:])
    DATA.mkdir(parents=True, exist_ok=True)
    apply_settings_env()
    sync_agents_into_profiles()
    if "--once" in argv:
        run_once_force()
        return 0

    print("[morning] The AI Times morning agent online (generate → email → print)")
    while True:
        apply_settings_env()
        sync_agents_into_profiles()
        state = load_json(STATE, {"doneKeys": []})
        for path in profile_paths():
            try:
                process_profile(path, state)
            except Exception as exc:  # noqa: BLE001
                print(f"[morning] profile {path.name} error: {exc}")
        save_json(STATE, state)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
