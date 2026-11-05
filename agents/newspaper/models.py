from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Article:
    id: str
    title: str
    summary: str
    source: str
    url: str
    category: str = "world"
    published_at: str = ""
    image_url: str | None = None
    local_image: str | None = None
    breaking: bool = False
    score: float = 0
    dek: str = ""
    byline: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class EditionPlan:
    paper_title: str
    date_label: str
    kicker: str
    editor_note: str
    weather_line: str
    sections: list[dict[str, Any]] = field(default_factory=list)
    articles: list[Article] = field(default_factory=list)
    template: str = "classic"

    def to_dict(self) -> dict[str, Any]:
        return {
            "paper_title": self.paper_title,
            "date_label": self.date_label,
            "kicker": self.kicker,
            "editor_note": self.editor_note,
            "weather_line": self.weather_line,
            "sections": self.sections,
            "articles": [a.to_dict() for a in self.articles],
            "template": self.template,
        }
