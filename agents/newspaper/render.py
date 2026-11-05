from __future__ import annotations

import base64
import mimetypes
from collections import defaultdict
from dataclasses import dataclass, field
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
    stream: list = field(default_factory=list)  # dense flat list for column packing
    briefs: list = field(default_factory=list)


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
    """Pack ~8–10 stories per A4 page in a continuous stream so columns stay full."""
    articles = plan.articles
    if not articles:
        return [PageView(1, None, {}, [], [], [], [])]

    section_for = {}
    for block in plan.sections:
        for aid in block.get("article_ids", []):
            section_for[aid] = block.get("name", "Briefs")

    views = []
    for article in articles:
        section = section_for.get(article.id) or getattr(article, "_section", None) or article.category.title()
        views.append(_article_view(article, section))

    # Dense packing: prefer filling pages over respecting a high page count with sparse content.
    per_page = 9
    needed = max(1, (len(views) + per_page - 1) // per_page)
    pages = max(1, min(int(pages or 1), needed))

    lead = views[0]
    rest = views[1:]

    # Distribute remaining stories as evenly as possible, never leaving a nearly-empty page.
    if pages == 1:
        chunks = [rest]
    else:
        # Page 1 gets a slightly heavier load under the lead.
        base = len(rest) // pages
        extra = len(rest) % pages
        sizes = [base + (1 if i < extra else 0) for i in range(pages)]
        # Ensure page 1 has at least 5 supporting stories when available.
        if sizes[0] < min(5, len(rest)) and len(rest) >= 5:
            deficit = min(5, len(rest)) - sizes[0]
            for i in range(pages - 1, 0, -1):
                take = min(deficit, max(0, sizes[i] - 2))
                sizes[i] -= take
                sizes[0] += take
                deficit -= take
                if deficit <= 0:
                    break
        chunks = []
        idx = 0
        for size in sizes:
            chunks.append(rest[idx : idx + size])
            idx += size

    out: list[PageView] = []
    for i, chunk in enumerate(chunks):
        groups: dict[str, list] = defaultdict(list)
        for item in chunk:
            groups[item["section"]].append(item)

        if i == 0:
            side = chunk[:2]
            stream = chunk
            # Briefs = overflow labels for very dense pages (last few without images in templates)
            briefs = chunk[6:] if len(chunk) > 6 else []
            out.append(
                PageView(
                    number=1,
                    lead=lead,
                    groups=dict(groups),
                    side_features=side,
                    magazine_items=chunk,
                    stream=stream,
                    briefs=briefs,
                )
            )
        else:
            page_lead = chunk[0] if chunk else None
            body = chunk[1:] if chunk else []
            for item in body:
                groups[item["section"]].append(item)
            out.append(
                PageView(
                    number=i + 1,
                    lead=page_lead,
                    groups=dict(groups),
                    side_features=body[:2],
                    magazine_items=chunk,
                    stream=chunk,
                    briefs=chunk[5:] if len(chunk) > 5 else [],
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
