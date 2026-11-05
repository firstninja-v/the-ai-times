from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
AGENTS = Path(__file__).resolve().parents[1]
DATA = ROOT / ".ai-times"
EDITIONS = DATA / "editions"
IMAGES = DATA / "images"
INBOX = DATA / "inbox"
TEMPLATES = Path(__file__).resolve().parent / "templates"

load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")
load_dotenv(AGENTS / ".env")


@dataclass
class LLMConfig:
    api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "")))
    base_url: str = field(
        default_factory=lambda: os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    )
    model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o-mini"))
    timeout: float = float(os.getenv("LLM_TIMEOUT", "60"))
    enabled: bool = True

    def __post_init__(self) -> None:
        if not self.api_key:
            self.enabled = False


@dataclass
class EmailConfig:
    host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", ""))
    port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "587")))
    user: str = field(default_factory=lambda: os.getenv("SMTP_USER", ""))
    password: str = field(default_factory=lambda: os.getenv("SMTP_PASS", ""))
    sender: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "The AI Times <news@localhost>"))
    )
    use_tls: bool = field(default_factory=lambda: os.getenv("SMTP_SECURE", "false").lower() != "true")
    use_ssl: bool = field(default_factory=lambda: os.getenv("SMTP_SECURE", "false").lower() == "true")

    @property
    def configured(self) -> bool:
        return bool(self.host and self.user and self.password)


@dataclass
class StudioConfig:
    llm: LLMConfig = field(default_factory=LLMConfig)
    email: EmailConfig = field(default_factory=EmailConfig)
    default_template: str = field(default_factory=lambda: os.getenv("NEWSPAPER_TEMPLATE", "classic"))
    paper_title: str = field(default_factory=lambda: os.getenv("PAPER_TITLE", "The AI Times"))
    max_articles: int = field(default_factory=lambda: int(os.getenv("NEWSPAPER_MAX_ARTICLES", "12")))
    pages: int = field(default_factory=lambda: int(os.getenv("NEWSPAPER_PAGES", "4")))


TEMPLATES_META = {
    "classic": {
        "name": "Classic Broadsheet",
        "description": "Traditional ink masthead, multi-column body, serif readability.",
    },
    "modern": {
        "name": "Modern Daily",
        "description": "Clean Apple-like spacing, large lead image, soft rules.",
    },
    "compact": {
        "name": "Compact Brief",
        "description": "Dense but readable morning brief for quick scanning.",
    },
    "broadsheet": {
        "name": "Sunday Broadsheet",
        "description": "Wide editorial layout with feature photography.",
    },
    "magazine": {
        "name": "Magazine Fold",
        "description": "Magazine-inspired feature spread with bold imagery.",
    },
}
