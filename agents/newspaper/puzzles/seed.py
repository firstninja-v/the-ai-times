from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

from ..config import DATA

HISTORY = DATA / "puzzles" / "history.json"


def day_key(d: date | None = None) -> str:
    return (d or date.today()).isoformat()


def rng_seed(*parts: str, salt: int = 0) -> int:
    raw = "|".join([*parts, str(salt)]).encode("utf-8")
    return int(hashlib.sha256(raw).hexdigest()[:16], 16)


def fingerprint(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def load_history() -> dict:
    if not HISTORY.exists():
        return {"fingerprints": [], "byDay": {}, "articleIds": []}
    try:
        return json.loads(HISTORY.read_text("utf-8"))
    except json.JSONDecodeError:
        return {"fingerprints": [], "byDay": {}, "articleIds": []}


def save_history(data: dict) -> None:
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    # Cap growth
    data["fingerprints"] = list(dict.fromkeys(data.get("fingerprints") or []))[-4000:]
    data["articleIds"] = list(dict.fromkeys(data.get("articleIds") or []))[-8000:]
    HISTORY.write_text(json.dumps(data, indent=2), encoding="utf-8")


def is_used(fp: str, history: dict | None = None) -> bool:
    history = history or load_history()
    return fp in set(history.get("fingerprints") or [])


def mark_used(fps: list[str], *, day: str, kinds: list[str], article_ids: list[str] | None = None) -> None:
    history = load_history()
    fps_set = list(history.get("fingerprints") or [])
    for fp in fps:
        if fp not in fps_set:
            fps_set.append(fp)
    history["fingerprints"] = fps_set
    by_day = history.get("byDay") or {}
    by_day[day] = {"kinds": kinds, "fingerprints": fps}
    history["byDay"] = by_day
    if article_ids:
        arts = list(history.get("articleIds") or [])
        for aid in article_ids:
            if aid not in arts:
                arts.append(aid)
        history["articleIds"] = arts
    save_history(history)


def used_article_ids() -> set[str]:
    return set((load_history().get("articleIds") or []))
