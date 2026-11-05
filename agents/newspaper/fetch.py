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
            summary = _clean(entry.get("summary") or entry.get("description") or "")[:400]
            link = entry.get("link") or url
            image = None
            if entry.get("media_content"):
                image = entry["media_content"][0].get("url")
            elif entry.get("media_thumbnail"):
                image = entry["media_thumbnail"][0].get("url")
            elif entry.get("links"):
                for link_obj in entry.links:
                    if str(link_obj.get("type", "")).startswith("image"):
                        image = link_obj.get("href")
                        break
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


def collect_articles(limit: int = 40) -> list[Article]:
    inbox = load_inbox(limit)
    if len(inbox) >= max(6, limit // 2):
        return inbox[:limit]
    feeds = fetch_feeds(limit)
    merged = {a.id: a for a in feeds}
    for article in inbox:
        merged[article.id] = article
    return list(merged.values())[:limit]
