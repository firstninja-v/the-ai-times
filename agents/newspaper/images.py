from __future__ import annotations

import hashlib
import re
from pathlib import Path
from urllib.parse import quote

import httpx
from PIL import Image, ImageDraw, ImageFont

from .config import IMAGES
from .models import Article


def _safe_name(value: str) -> str:
    digest = hashlib.sha1(value.encode()).hexdigest()[:12]
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")[:40] or "img"
    return f"{slug}-{digest}.jpg"


def _placeholder(path: Path, title: str, category: str) -> Path:
    IMAGES.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (1280, 720), "#1d1d1f")
    draw = ImageDraw.Draw(img)
    # subtle gradient bars
    for i in range(720):
        shade = 29 + int(18 * (i / 720))
        draw.line([(0, i), (1280, i)], fill=(shade, shade, shade + 4))
    draw.rectangle([(48, 48), (1232, 672)], outline="#f5f5f7", width=2)
    label = f"{category.upper()}  ·  THE AI TIMES"
    draw.text((72, 90), label, fill="#a1a1a6")
    # wrap title
    words = title.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) > 42:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    y = 180
    for line in lines[:5]:
        draw.text((72, y), line, fill="#f5f5f7")
        y += 58
    img.save(path, format="JPEG", quality=88)
    return path


def download_image(url: str, dest: Path) -> bool:
    try:
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            res = client.get(url, headers={"User-Agent": "TheAITimes/0.2"})
            res.raise_for_status()
            ctype = res.headers.get("content-type", "")
            if "image" not in ctype and not url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                return False
            dest.write_bytes(res.content)
            # normalize to jpeg via pillow when possible
            try:
                with Image.open(dest) as im:
                    rgb = im.convert("RGB")
                    rgb.save(dest, format="JPEG", quality=88)
            except Exception:  # noqa: BLE001
                pass
            return dest.stat().st_size > 1000
    except Exception:  # noqa: BLE001
        return False


def stock_fallback(query: str, dest: Path) -> bool:
    """Public placeholder imagery keyed by query (no API key required)."""
    seed = quote(query[:60] or "news")
    url = f"https://picsum.photos/seed/{seed}/1280/720"
    return download_image(url, dest)


def attach_images(articles: list[Article], image_queries: dict[str, str] | None = None) -> list[Article]:
    IMAGES.mkdir(parents=True, exist_ok=True)
    image_queries = image_queries or {}
    enriched: list[Article] = []
    for article in articles:
        filename = _safe_name(article.id + article.title)
        dest = IMAGES / filename
        ok = False
        if article.image_url:
            ok = download_image(article.image_url, dest)
        if not ok:
            query = image_queries.get(article.id) or f"{article.category} {article.title[:40]}"
            ok = stock_fallback(query, dest)
        if not ok:
            _placeholder(dest, article.title, article.category)
        article.local_image = str(dest)
        enriched.append(article)
    return enriched
