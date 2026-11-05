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
    """OpenAI-compatible chat client, with Anthropic Messages fallback."""

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or LLMConfig()

    @property
    def ready(self) -> bool:
        # Ollama often accepts any/no key; treat enabled + base_url as enough when key blank for local.
        if not self.config.enabled:
            return False
        if self.config.api_key:
            return True
        return "11434" in self.config.base_url or "ollama" in self.config.base_url.lower()

    def _is_anthropic(self) -> bool:
        return "anthropic.com" in self.config.base_url.lower()

    def chat_json(self, user_prompt: str) -> dict[str, Any]:
        if not self.ready:
            raise RuntimeError("LLM API key missing. Set LLM_API_KEY (or OPENAI_API_KEY).")

        if self._is_anthropic():
            return self._anthropic_json(user_prompt)
        return self._openai_json(user_prompt)

    def _openai_json(self, user_prompt: str) -> dict[str, Any]:
        payload = {
            "model": self.config.model,
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
        }
        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.api_key or 'ollama'}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self.config.timeout) as client:
            res = client.post(url, headers=headers, json=payload)
            if res.status_code >= 400 and "response_format" in payload:
                payload.pop("response_format", None)
                res = client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()

        content = data["choices"][0]["message"]["content"]
        return _extract_json(content)

    def _anthropic_json(self, user_prompt: str) -> dict[str, Any]:
        # Native Anthropic Messages API (not OpenAI-compatible).
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.config.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.config.model,
            "max_tokens": 4096,
            "temperature": 0.3,
            "system": SYSTEM,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        with httpx.Client(timeout=self.config.timeout) as client:
            res = client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
        parts = data.get("content") or []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
        return _extract_json(text)

    def edit_edition(
        self,
        *,
        paper_title: str,
        date_label: str,
        articles: list[Article],
        company: str | None = None,
        volume_id: str = "more",
        body_sentences: int = 5,
    ) -> dict[str, Any]:
        compact = [
            {
                "id": a.id,
                "title": a.title,
                "summary": a.summary[:420],
                "source": a.source,
                "category": a.category,
                "breaking": a.breaking,
            }
            for a in articles
        ]
        prompt = f"""
Create today's newspaper plan with REAL READING MATTER — not tiny blurbs.

Paper title: {paper_title}
Date: {date_label}
Company focus: {company or "general audience"}
Content volume: {volume_id} (target about {body_sentences} sentences of body per story)

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
  - summary (short teaser, 1-2 sentences)
  - body ({body_sentences} clean newspaper sentences expanding the wire — no hype, no ads, grounded in the given summary)
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
    volume: dict | None = None,
) -> dict[str, Any]:
    """Offline fallback when no API key is configured."""
    from .volume import expand_body, resolve_volume

    volume = volume or resolve_volume("more")
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
        body = expand_body(
            article.title,
            article.summary,
            source=article.source,
            category=article.category,
            volume=volume,
        )
        edited.append(
            {
                "id": article.id,
                "title": article.title,
                "dek": article.summary.split(".")[0][:160],
                "summary": article.summary,
                "body": body,
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
            + f" in a {volume.get('label', 'full')} reading pack."
        ),
        "weather_line": "Clear skies for focused reading.",
        "articles": edited,
    }
