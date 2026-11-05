#!/usr/bin/env python3
"""
The AI Times — always-on news desk agent.

Collects from premium RSS providers + Scrapling HTML sources, scores importance,
writes into .ai-times/inbox, and posts breaking items to the Next.js API.
Runs in a continuous loop (default every 90s).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import feedparser
from scrapling.fetchers import Fetcher

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".ai-times"
INBOX = DATA / "inbox"
STATE = DATA / "agent-state.json"
SOURCES = Path(__file__).with_name("sources.json")
PROFILES = DATA / "profiles"

API_BASE = os.environ.get("AI_TIMES_API", "http://127.0.0.1:43123")
POLL_SECONDS = int(os.environ.get("AI_TIMES_AGENT_POLL", "90"))

SLOP = re.compile(
    r"sponsored|advertorial|\bad\b|gift guide|shop now|you won't believe|click here|celebrity diet",
    re.I,
)
BREAKING = re.compile(r"\b(breaking|urgent|just in|alert|developing)\b", re.I)
IMPORTANCE = [
    (re.compile(r"\b(war|invasion|earthquake|crash|assassination|coup)\b", re.I), 8),
    (re.compile(r"\b(fed|interest rate|recession|bailout|default)\b", re.I), 6),
    (re.compile(r"\b(layoff|acquisition|ipo|antitrust|breach|outage)\b", re.I), 5),
    (re.compile(r"\b(election|supreme court|sanctions|ceasefire)\b", re.I), 5),
    (re.compile(r"\b(ai|chip|openai|nvidia|model)\b", re.I), 3),
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def article_id(title: str, url: str) -> str:
    return hashlib.sha1(f"{title}|{url}".encode("utf-8")).hexdigest()[:16]


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


def score_article(title: str, summary: str, company_keywords: list[str]) -> tuple[int, bool]:
    text = f"{title} {summary}"
    if SLOP.search(text):
        return -10, False
    score = 1
    breaking = bool(BREAKING.search(text))
    if breaking:
        score += 6
    for pattern, weight in IMPORTANCE:
        if pattern.search(text):
            score += weight
    for kw in company_keywords:
        if kw and kw.lower() in text.lower():
            score += 4
    return score, breaking or score >= 12


def fetch_rss(provider: dict) -> list[dict]:
    parsed = feedparser.parse(provider["url"])
    items = []
    for entry in parsed.entries[:20]:
        title = (entry.get("title") or "").strip()
        summary = re.sub(r"<[^>]+>", " ", entry.get("summary") or entry.get("description") or "")
        summary = re.sub(r"\s+", " ", summary).strip()[:360]
        link = entry.get("link") or provider["url"]
        published = entry.get("published") or entry.get("updated") or utc_now()
        if not title:
            continue
        items.append(
            {
                "id": article_id(title, link),
                "title": title,
                "summary": summary or "No summary provided.",
                "source": provider["name"],
                "url": link,
                "publishedAt": published,
                "category": provider.get("category", "world"),
                "providerId": provider["id"],
                "tier": provider.get("tier", "standard"),
            }
        )
    return items


def fetch_scrapling(provider: dict) -> list[dict]:
    page = Fetcher.get(provider["url"])
    selector = (provider.get("selectors") or {}).get("item") or "a"
    nodes = page.css(selector)[:30]
    items = []
    seen = set()
    for node in nodes:
        title = (node.text or "").strip()
        href = node.attrib.get("href") if hasattr(node, "attrib") else None
        if not title or len(title) < 18 or title in seen:
            continue
        seen.add(title)
        if href and href.startswith("/"):
            from urllib.parse import urljoin

            href = urljoin(provider["url"], href)
        link = href or provider["url"]
        items.append(
            {
                "id": article_id(title, link),
                "title": title,
                "summary": f"Collected from {provider['name']} via Scrapling.",
                "source": provider["name"],
                "url": link,
                "publishedAt": utc_now(),
                "category": provider.get("category", "world"),
                "providerId": provider["id"],
                "tier": provider.get("tier", "standard"),
            }
        )
    return items


def company_keywords() -> list[str]:
    keywords: list[str] = []
    if not PROFILES.exists():
        return keywords
    for path in PROFILES.glob("*.json"):
        profile = load_json(path, {})
        keywords.extend(profile.get("keywords") or [])
        if profile.get("companyName"):
            keywords.append(profile["companyName"])
        keywords.extend(profile.get("competitors") or [])
    # unique preserve order
    out = []
    for k in keywords:
        if k and k not in out:
            out.append(k)
    return out


def collect(providers: list[dict], keywords: list[str]) -> list[dict]:
    articles: list[dict] = []
    for provider in providers:
        try:
            if provider.get("kind") == "scrapling":
                batch = fetch_scrapling(provider)
            else:
                batch = fetch_rss(provider)
            for item in batch:
                score, breaking = score_article(item["title"], item["summary"], keywords)
                item["score"] = score
                item["breaking"] = breaking
                if score > 0:
                    articles.append(item)
            print(f"[desk] {provider['id']}: {len(batch)} raw")
        except Exception as exc:  # noqa: BLE001 - keep loop alive
            print(f"[desk] {provider['id']} failed: {exc}")
    # dedupe by id, keep highest score
    best: dict[str, dict] = {}
    for article in articles:
        prev = best.get(article["id"])
        if not prev or article["score"] > prev["score"]:
            best[article["id"]] = article
    ranked = sorted(best.values(), key=lambda a: a["score"], reverse=True)
    return ranked


def write_inbox(articles: list[dict]) -> Path:
    INBOX.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = INBOX / f"batch-{stamp}.json"
    save_json(
        path,
        {
            "collectedAt": utc_now(),
            "count": len(articles),
            "articles": articles,
        },
    )
    # also keep latest pointer
    save_json(INBOX / "latest.json", {"path": path.name, "collectedAt": utc_now(), "count": len(articles)})
    return path


def post_ingest(articles: list[dict], breaking_only: bool = False) -> None:
    payload = {
        "articles": articles if not breaking_only else [a for a in articles if a.get("breaking")],
        "source": "news_agent",
        "collectedAt": utc_now(),
    }
    if not payload["articles"]:
        return
    req = urllib.request.Request(
        f"{API_BASE}/api/ingest",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            body = res.read().decode("utf-8")
            print(f"[desk] ingest -> {res.status} {body[:180]}")
    except urllib.error.URLError as exc:
        print(f"[desk] ingest offline ({exc}); kept local inbox")


def load_seen(state: dict) -> set[str]:
    return set(state.get("seenIds") or [])


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    INBOX.mkdir(parents=True, exist_ok=True)
    providers = load_json(SOURCES, {"providers": []}).get("providers", [])
    print(f"[desk] The AI Times news agent online · {len(providers)} providers · poll {POLL_SECONDS}s")
    print(f"[desk] API {API_BASE}")

    while True:
        state = load_json(STATE, {"seenIds": [], "cycles": 0, "lastRunAt": None})
        keywords = company_keywords()
        articles = collect(providers, keywords)
        path = write_inbox(articles)
        seen = load_seen(state)
        fresh = [a for a in articles if a["id"] not in seen]
        breaking = [a for a in fresh if a.get("breaking")]

        post_ingest(fresh[:40])
        if breaking:
            post_ingest(breaking, breaking_only=True)
            print(f"[desk] BREAKING x{len(breaking)}: {breaking[0]['title'][:80]}")

        state["seenIds"] = list(seen.union(a["id"] for a in fresh))[-2000:]
        state["cycles"] = int(state.get("cycles") or 0) + 1
        state["lastRunAt"] = utc_now()
        state["lastInbox"] = path.name
        state["lastCount"] = len(articles)
        state["lastBreaking"] = len(breaking)
        save_json(STATE, state)
        print(f"[desk] cycle {state['cycles']}: {len(articles)} kept, {len(fresh)} fresh, inbox {path.name}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
