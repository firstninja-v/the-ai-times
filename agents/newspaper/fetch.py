from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import feedparser

from .config import INBOX
from .models import Article

DEFAULT_FEEDS = [
    ("world", "BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("business", "BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("technology", "BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("science", "BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ("culture", "Guardian Culture", "https://www.theguardian.com/uk/culture/rss"),
    ("technology", "TechCrunch", "https://techcrunch.com/feed/"),
]


def _id(title: str, url: str) -> str:
    return hashlib.sha1(f"{title}|{url}".encode()).hexdigest()[:16]


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def load_inbox(limit: int = 40) -> list[Article]:
    if not INBOX.exists():
        return []
    files = sorted(INBOX.glob("batch-*.json"), reverse=True)[:3]
    articles: list[Article] = []
    for path in files:
        try:
            data = json.loads(path.read_text("utf-8"))
        except json.JSONDecodeError:
            continue
        for raw in data.get("articles", []):
            articles.append(
                Article(
                    id=raw.get("id") or _id(raw.get("title", ""), raw.get("url", "")),
                    title=raw.get("title", "Untitled"),
                    summary=_clean(raw.get("summary", ""))[:400],
                    source=raw.get("source", "Wire"),
                    url=raw.get("url", "#"),
                    category=raw.get("category", "world"),
                    published_at=raw.get("publishedAt", ""),
                    image_url=raw.get("imageUrl"),
                    breaking=bool(raw.get("breaking")),
                    score=float(raw.get("score") or 0),
                )
            )
    # dedupe
    best: dict[str, Article] = {}
    for article in articles:
        prev = best.get(article.id)
        if not prev or article.score > prev.score:
            best[article.id] = article
    return sorted(best.values(), key=lambda a: a.score, reverse=True)[:limit]


def _entry_image(entry, raw_html: str = "") -> str | None:
    if entry.get("media_content"):
        url = entry["media_content"][0].get("url")
        if url:
            return url
    if entry.get("media_thumbnail"):
        url = entry["media_thumbnail"][0].get("url")
        if url:
            return url
    if entry.get("links"):
        for link_obj in entry.links:
            if str(link_obj.get("type", "")).startswith("image") or link_obj.get("rel") == "enclosure":
                href = link_obj.get("href")
                if href and any(ext in href.lower() for ext in (".jpg", ".jpeg", ".png", ".webp", "image")):
                    return href
    # Many RSS bodies embed the hero <img> before we strip HTML.
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw_html or "", re.I)
    if match:
        return match.group(1)
    return None


def fetch_feeds(limit: int = 40) -> list[Article]:
    articles: list[Article] = []
    for category, name, url in DEFAULT_FEEDS:
        try:
            parsed = feedparser.parse(url)
        except Exception:  # noqa: BLE001
            continue
        for entry in parsed.entries[:8]:
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            raw_html = entry.get("summary") or entry.get("description") or ""
            if entry.get("content"):
                try:
                    raw_html = entry.content[0].get("value") or raw_html
                except Exception:  # noqa: BLE001
                    pass
            summary = _clean(raw_html)[:400]
            link = entry.get("link") or url
            image = _entry_image(entry, raw_html)
            articles.append(
                Article(
                    id=_id(title, link),
                    title=title,
                    summary=summary or "No summary provided.",
                    source=name,
                    url=link,
                    category=category,
                    published_at=entry.get("published") or "",
                    image_url=image,
                    breaking=bool(re.search(r"breaking|urgent|just in", title, re.I)),
                )
            )
    return articles[:limit]


def collect_articles(limit: int = 40, *, exclude_ids: set[str] | None = None) -> list[Article]:
    """Collect stories, preferring ones not already printed in prior editions."""
    exclude_ids = exclude_ids or set()
    inbox = load_inbox(limit * 2)
    feeds = fetch_feeds(limit * 2)
    # Index feed images by URL / title so inbox rows can borrow original art.
    by_url = {a.url: a for a in feeds if a.url}
    by_title = {a.title.lower(): a for a in feeds if a.title}

    merged: dict[str, Article] = {a.id: a for a in feeds}
    for article in inbox:
        donor = by_url.get(article.url) or by_title.get(article.title.lower())
        if donor and not article.image_url and donor.image_url:
            article.image_url = donor.image_url
        if article.id in merged and merged[article.id].image_url and not article.image_url:
            article.image_url = merged[article.id].image_url
        # Prefer higher-scored inbox copy, but never drop a known wire image.
        prev = merged.get(article.id)
        if prev and prev.image_url and not article.image_url:
            article.image_url = prev.image_url
        merged[article.id] = article

    # Also try to fill any remaining holes from title/url matches across the set.
    for article in merged.values():
        if article.image_url:
            continue
        donor = by_url.get(article.url) or by_title.get(article.title.lower())
        if donor and donor.image_url:
            article.image_url = donor.image_url

    def _rank(article: Article) -> float:
        # Prefer scored inbox hits, but keep illustrated wire stories near the top
        # so editions aren't filled with blank placeholder cards.
        return float(article.score) + (5.0 if article.image_url else 0.0)

    fresh = [a for a in merged.values() if a.id not in exclude_ids]
    fresh.sort(key=_rank, reverse=True)
    if len(fresh) >= max(6, limit // 2):
        return fresh[:limit]

    # If the wire is thin, fall back to full set but still prefer unseen first.
    rest = [a for a in merged.values() if a.id in exclude_ids]
    rest.sort(key=_rank, reverse=True)
    return (fresh + rest)[:limit]
