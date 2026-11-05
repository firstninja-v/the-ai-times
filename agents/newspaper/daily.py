#!/usr/bin/env python3
"""Cron-friendly daily generator: all templates optional, email optional."""

from __future__ import annotations

import os

from .generate import generate_edition


def run() -> None:
    template = os.getenv("NEWSPAPER_TEMPLATE", "classic")
    title = os.getenv("PAPER_TITLE", "The AI Times")
    email = os.getenv("NEWSPAPER_EMAIL_TO") or os.getenv("SMTP_TO")
    company = os.getenv("PAPER_COMPANY")
    pages = int(os.getenv("NEWSPAPER_PAGES", "4"))
    font = os.getenv("NEWSPAPER_FONT", "georgia")
    color_mode = os.getenv("NEWSPAPER_COLOR", "color")
    news_prompt = os.getenv("NEWSPAPER_PROMPT")
    use_llm = os.getenv("NEWSPAPER_USE_LLM", "1") != "0"

    result = generate_edition(
        template=template,
        paper_title=title,
        pages=pages,
        company=company,
        use_llm=use_llm,
        email_to=email,
        news_prompt=news_prompt,
        font=font,
        color_mode=color_mode,
    )
    print(result)


if __name__ == "__main__":
    run()
