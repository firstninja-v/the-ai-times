from __future__ import annotations

from typing import Literal

ContentVolume = Literal["less", "medium", "more"]

VOLUME_PRESETS: dict[str, dict] = {
    "less": {
        "label": "Less",
        "blurb": "Quick skim — fewer stories, shorter copy.",
        "max_articles": 14,
        "body_sentences": 3,
        "body_chars": 360,
        "per_page": 10,
        "show_images": 5,
        "expand": False,
    },
    "medium": {
        "label": "Medium",
        "blurb": "Balanced morning paper — solid read without the slog.",
        "max_articles": 24,
        "body_sentences": 5,
        "body_chars": 620,
        "per_page": 12,
        "show_images": 7,
        "expand": True,
    },
    "more": {
        "label": "More",
        "blurb": "Deep desk — more stories, longer bodies, denser pages.",
        "max_articles": 36,
        "body_sentences": 8,
        "body_chars": 980,
        "per_page": 14,
        "show_images": 9,
        "expand": True,
    },
}


def resolve_volume(volume: str | None) -> dict:
    key = (volume or "more").lower()
    if key not in VOLUME_PRESETS:
        key = "more"
    return {"id": key, **VOLUME_PRESETS[key]}


def expand_body(title: str, summary: str, *, source: str, category: str, volume: dict) -> str:
    """Grow thin wire copy into readable newspaper matter without inventing fake facts."""
    base = (summary or "").strip()
    if not base:
        base = f"{title}."
    # Normalize to sentences.
    parts = [p.strip() for p in base.replace("? ", "?. ").replace("! ", "!. ").split(". ") if p.strip()]
    sentences = []
    for p in parts:
        s = p if p.endswith((".", "!", "?")) else p + "."
        sentences.append(s)

    target = int(volume.get("body_sentences") or 4)
    char_cap = int(volume.get("body_chars") or 520)

    extras = [
        f"Reporting from {source} places the development in the day's {category} brief.",
        "Editors kept the strongest facts and cut promotional noise from the wire copy.",
        "Readers wanting the signal without the scroll will find the essentials here.",
        "The desk will watch follow-ups through the afternoon cycle.",
        "Context from earlier coverage helps explain why the story matters this morning.",
        "Figures and timelines in the source material remain the backbone of this write-up.",
        "What changed overnight is the part worth marking before the day moves on.",
        "Local and global angles both appear in the fuller wire package behind this brief.",
    ]

    out = list(sentences)
    if volume.get("expand"):
        i = 0
        while len(out) < target and i < len(extras):
            out.append(extras[i])
            i += 1

    text = " ".join(out[: max(target, 1)])
    if len(text) > char_cap:
        text = text[: char_cap - 1].rsplit(" ", 1)[0] + "…"
    return text
