from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .config import LLMConfig
from .models import Article


SYSTEM = """You are a newspaper desk editor for The AI Times.
Rewrite for clarity and signal. No hype, no ads, no clickbait.
Return strict JSON only."""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


class LLMClient:
    """OpenAI-compatible chat client for any smaller hosted model."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()

    @property
    def ready(self) -> bool:
        return self.config.enabled and bool(self.config.api_key)

    def chat_json(self, user_prompt: str) -> dict[str, Any]:
        if not self.ready:
            raise RuntimeError("LLM API key missing. Set LLM_API_KEY (or OPENAI_API_KEY).")

        payload = {
            "model": self.config.model,
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
        }
        url = f"{self.config.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.config.timeout) as client:
                res = client.post(url, headers=headers, json=payload)
                if res.status_code >= 400 and "response_format" in payload:
                    # Some small providers reject response_format — retry without it.
                    payload.pop("response_format", None)
                    res = client.post(url, headers=headers, json=payload)
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc

        content = data["choices"][0]["message"]["content"]
        return _extract_json(content)

    def edit_edition(
        self,
        *,
        paper_title: str,
        date_label: str,
        articles: list[Article],
        company: str | None = None,
    ) -> dict[str, Any]:
        compact = [
            {
                "id": a.id,
                "title": a.title,
                "summary": a.summary[:280],
                "source": a.source,
                "category": a.category,
                "breaking": a.breaking,
            }
            for a in articles
        ]
        prompt = f"""
Create today's newspaper plan.

Paper title: {paper_title}
Date: {date_label}
Company focus: {company or "general audience"}

Articles JSON:
{json.dumps(compact, ensure_ascii=False)}

Return JSON with keys:
- kicker (short uppercase line)
- editor_note (1-2 sentences)
- weather_line (one atmospheric line, not real weather API needed)
- articles: array matching input ids with fields:
  - id
  - title (improved headline, max 14 words)
  - dek (1 sentence subhead)
  - summary (2-3 clean sentences)
  - byline (e.g. "By The AI Times Desk" or source-based)
  - section (one of: Lead, World, Business, Technology, Science, Culture, Sports, Company, Briefs)
  - image_query (3-6 word photo search phrase)
"""
        return self.chat_json(prompt)


def heuristic_edit(
    *,
    paper_title: str,
    date_label: str,
    articles: list[Article],
    company: str | None = None,
) -> dict[str, Any]:
    """Offline fallback when no API key is configured."""
    section_map = {
        "world": "World",
        "business": "Business",
        "technology": "Technology",
        "science": "Science",
        "health": "Science",
        "politics": "World",
        "culture": "Culture",
        "sports": "Sports",
        "climate": "Science",
        "local": "Briefs",
    }
    edited = []
    for idx, article in enumerate(articles):
        section = "Lead" if idx == 0 else section_map.get(article.category, "Briefs")
        if company and company.lower() in f"{article.title} {article.summary}".lower():
            section = "Company" if idx else "Lead"
        edited.append(
            {
                "id": article.id,
                "title": article.title,
                "dek": article.summary.split(".")[0][:140],
                "summary": article.summary,
                "byline": f"By {article.source}",
                "section": section,
                "image_query": f"{article.category} news photography",
            }
        )
    return {
        "kicker": "ALL THE SIGNAL · NONE OF THE SLOP",
        "editor_note": (
            f"{paper_title} gathered today's strongest stories"
            + (f" for {company}" if company else "")
            + " and cut the noise."
        ),
        "weather_line": "Clear skies for focused reading.",
        "articles": edited,
    }
