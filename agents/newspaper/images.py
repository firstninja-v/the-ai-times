from __future__ import annotations

import hashlib
import re
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

from .config import IMAGES
from .models import Article

CATEGORY_PALETTE = {
    "world": ("#1c3d5a", "#dbe7f3"),
    "business": ("#1f3b2c", "#d8e7de"),
    "technology": ("#2a2150", "#e4dff5"),
    "science": ("#163a3a", "#d5efef"),
    "culture": ("#4a2c1a", "#f3e4d7"),
    "sports": ("#3b1d2a", "#f0d9e2"),
    "health": ("#1a3340", "#d7eaf0"),
    "climate": ("#1f3a20", "#dcefdc"),
    "local": ("#333333", "#ececec"),
}


def _safe_name(value: str) -> str:
    digest = hashlib.sha1(value.encode()).hexdigest()[:12]
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")[:40] or "img"
    return f"{slug}-{digest}.jpg"


def _font(size: int):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:  # noqa: BLE001
            continue
    return ImageFont.load_default()


def _placeholder(path: Path, title: str, category: str, *, salt: str = "") -> Path:
    """Unique editorial card — never reuse random stock pets."""
    IMAGES.mkdir(parents=True, exist_ok=True)
    bg, fg = CATEGORY_PALETTE.get(category.lower(), ("#222222", "#f2f2f2"))
    # Deterministic hue shift from title so neighboring stories look different.
    digest = hashlib.sha1(f"{title}|{category}|{salt}".encode()).hexdigest()
    shift = int(digest[:2], 16)
    bg_rgb = tuple(max(0, min(255, int(bg.lstrip("#")[i : i + 2], 16) + (shift % 24) - 12)) for i in (0, 2, 4))
    img = Image.new("RGB", (1280, 720), bg_rgb)
    draw = ImageDraw.Draw(img)

    # Geometric motif unique to hash
    accent = tuple((c + 40) % 256 for c in bg_rgb)
    for i in range(8):
        x0 = (int(digest[i * 2 : i * 2 + 2], 16) * 5) % 1200
        y0 = (int(digest[i * 2 + 2 : i * 2 + 4], 16) * 3) % 640
        draw.rectangle([x0, y0, x0 + 120, y0 + 80], outline=accent, width=3)

    draw.rectangle([(40, 40), (1240, 680)], outline=fg, width=3)
    label_font = _font(28)
    title_font = _font(48)
    draw.text((72, 72), f"{category.upper()}  ·  THE AI TIMES", fill=fg, font=label_font)

    words = title.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) > 28:
            if current:
                lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    y = 180
    for line in lines[:5]:
        draw.text((72, y), line, fill=fg, font=title_font)
        y += 64

    img.save(path, format="JPEG", quality=90)
    return path


def download_image(url: str, dest: Path) -> bool:
    try:
        # Prefer larger BBC/ichef variants when the feed only gave a 240px thumb.
        url = re.sub(r"/ace/standard/240/", "/ace/standard/976/", url)
        url = re.sub(r"/480/", "/960/", url)
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            res = client.get(
                url,
                headers={
                    "User-Agent": "TheAITimes/0.3 (+https://theaitimes.local)",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            )
            res.raise_for_status()
            ctype = res.headers.get("content-type", "")
            if "image" not in ctype and not url.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
                return False
            dest.write_bytes(res.content)
            try:
                with Image.open(dest) as im:
                    # Reject tiny / broken assets (RSS thumbs are often ~240px)
                    if min(im.size) < 80:
                        return False
                    # Upscale very small wire thumbs so A4 lead art isn't muddy.
                    w, h = im.size
                    if w < 640 or h < 360:
                        scale = max(640 / max(w, 1), 360 / max(h, 1))
                        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
                    rgb = im.convert("RGB")
                    rgb.save(dest, format="JPEG", quality=88)
            except Exception:  # noqa: BLE001
                return False
            return dest.stat().st_size > 2500
    except Exception:  # noqa: BLE001
        return False


def fetch_og_image(page_url: str) -> str | None:
    """Pull the article's Open Graph image when RSS forgot to include media."""
    if not page_url or page_url == "#":
        return None
    try:
        with httpx.Client(timeout=12, follow_redirects=True) as client:
            res = client.get(
                page_url,
                headers={"User-Agent": "TheAITimes/0.3 (+https://theaitimes.local)"},
            )
            res.raise_for_status()
            html = res.text[:120_000]
        match = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            html,
            re.I,
        ) or re.search(
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            html,
            re.I,
        )
        if match:
            return match.group(1)
    except Exception:  # noqa: BLE001
        return None
    return None


def _file_fingerprint(path: Path) -> str:
    try:
        return hashlib.sha1(path.read_bytes()[:64000]).hexdigest()
    except Exception:  # noqa: BLE001
        return ""


def attach_images(articles: list[Article], image_queries: dict[str, str] | None = None) -> list[Article]:
    """Attach original wire images when available; else unique editorial placeholders.

    Never use picsum/random stock (caused repeating dog photos). Never reuse the
    same binary across two stories on one edition.
    """
    IMAGES.mkdir(parents=True, exist_ok=True)
    image_queries = image_queries or {}
    seen_fingerprints: set[str] = set()
    enriched: list[Article] = []

    for idx, article in enumerate(articles):
        filename = _safe_name(f"{article.id}|{article.title}|{idx}")
        dest = IMAGES / filename
        ok = False

        image_url = article.image_url
        if not image_url and idx < 10 and article.url:
            # First stories on the page: try og:image so leads aren't placeholders.
            image_url = fetch_og_image(article.url)
            if image_url:
                article.image_url = image_url

        if image_url:
            ok = download_image(image_url, dest)
            if ok:
                fp = _file_fingerprint(dest)
                if fp and fp in seen_fingerprints:
                    # Same CDN asset reused by multiple wires — make a unique card instead.
                    ok = False
                elif fp:
                    seen_fingerprints.add(fp)

        if not ok:
            query = image_queries.get(article.id) or f"{article.category}:{article.title[:48]}:{idx}"
            _placeholder(dest, article.title, article.category, salt=query)
            fp = _file_fingerprint(dest)
            # Extremely unlikely collision; bump salt if needed.
            bump = 0
            while fp in seen_fingerprints and bump < 5:
                bump += 1
                _placeholder(dest, article.title, article.category, salt=f"{query}:{bump}")
                fp = _file_fingerprint(dest)
            if fp:
                seen_fingerprints.add(fp)

        article.local_image = str(dest)
        enriched.append(article)
    return enriched
