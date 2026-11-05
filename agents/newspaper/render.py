from __future__ import annotations

import base64
import mimetypes
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .config import TEMPLATES, TEMPLATES_META
from .models import Article, EditionPlan


def list_templates() -> dict[str, dict[str, str]]:
    return TEMPLATES_META


def _data_uri(path: str | None) -> str:
    if not path or not Path(path).exists():
        svg = (
            "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>"
            "<rect fill='#d0d0d0' width='100%' height='100%'/></svg>"
        )
        return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()
    p = Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
    encoded = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


@dataclass
class PageView:
    number: int
    lead: dict | None
    groups: dict
    side_features: list
    magazine_items: list


def _article_view(article: Article, section: str) -> dict:
    return {
        "id": article.id,
        "title": article.title,
        "dek": article.dek,
        "summary": article.summary,
        "byline": article.byline or f"By {article.source}",
        "section": section,
        "breaking": article.breaking,
        "image_src": _data_uri(article.local_image),
        "url": article.url,
        "source": article.source,
    }


def paginate(plan: EditionPlan, pages: int = 4) -> list[PageView]:
    """Pack articles densely so A4 pages stay full instead of sparse."""
    articles = plan.articles
    if not articles:
        return [PageView(1, None, {}, [], [])]

    section_for = {}
    for block in plan.sections:
        for aid in block.get("article_ids", []):
            section_for[aid] = block.get("name", "Briefs")

    views = []
    for article in articles:
        section = section_for.get(article.id) or getattr(article, "_section", None) or article.category.title()
        views.append(_article_view(article, section))

    # Aim for ~6–8 stories per A4 page (plus lead on page 1).
    per_page = 7
    needed = max(1, (len(views) + per_page - 1) // per_page)
    pages = max(1, min(pages, needed))

    lead = views[0]
    rest = views[1:]

    if pages == 1:
        groups: dict[str, list] = defaultdict(list)
        for item in rest:
            groups[item["section"]].append(item)
        return [
            PageView(
                number=1,
                lead=lead,
                groups=dict(groups),
                side_features=rest[:2],
                magazine_items=rest,
            )
        ]

    # Fill page 1 heavier, then pack remaining pages evenly but densely.
    page1_count = min(len(rest), max(per_page, (len(rest) + pages - 1) // pages + 1))
    chunks: list[list] = [rest[:page1_count]]
    remaining = rest[page1_count:]
    leftover_pages = pages - 1
    if leftover_pages and remaining:
        size = max(per_page - 1, (len(remaining) + leftover_pages - 1) // leftover_pages)
        for i in range(leftover_pages):
            chunks.append(remaining[i * size : (i + 1) * size])
    elif leftover_pages:
        chunks.extend([[] for _ in range(leftover_pages)])

    # Drop empty trailing pages.
    while len(chunks) > 1 and not chunks[-1]:
        chunks.pop()

    out: list[PageView] = []
    for i, chunk in enumerate(chunks):
        groups = defaultdict(list)
        if i == 0:
            side = chunk[:2]
            body = chunk[2:]
            for item in body:
                groups[item["section"]].append(item)
            # If body empty, still put side stories into groups so page isn't blank below lead.
            if not body and side:
                for item in side:
                    groups[item["section"]].append(item)
                side = side[:2]
            out.append(
                PageView(
                    number=1,
                    lead=lead,
                    groups=dict(groups),
                    side_features=side,
                    magazine_items=chunk,
                )
            )
        else:
            page_lead = chunk[0] if chunk else None
            body = chunk[1:] if chunk else []
            side = body[:2]
            for item in body:
                groups[item["section"]].append(item)
            out.append(
                PageView(
                    number=i + 1,
                    lead=page_lead,
                    groups=dict(groups),
                    side_features=side,
                    magazine_items=chunk,
                )
            )
    return out


def render_html(plan: EditionPlan, template_id: str, pages: int = 4) -> str:
    if template_id not in TEMPLATES_META:
        raise ValueError(f"Unknown template '{template_id}'. Choose from: {', '.join(TEMPLATES_META)}")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES / template_id)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    template = env.get_template("edition.html")
    page_views = paginate(plan, pages=pages)
    return template.render(
        paper_title=plan.paper_title,
        date_label=plan.date_label,
        kicker=plan.kicker,
        editor_note=plan.editor_note,
        weather_line=plan.weather_line,
        pages=page_views,
        template=template_id,
    )


def write_edition(html: str, out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return out_path
