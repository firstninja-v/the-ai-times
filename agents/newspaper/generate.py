from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from .config import EDITIONS, StudioConfig, TEMPLATES_META
from .emailer import send_edition_email
from .fetch import collect_articles
from .images import attach_images
from .llm import LLMClient, heuristic_edit
from .models import Article, EditionPlan
from .render import list_templates, render_html, write_edition


def _apply_edits(articles: list[Article], edited_payload: dict) -> tuple[list[Article], dict]:
    by_id = {a.id: a for a in articles}
    image_queries: dict[str, str] = {}
    ordered: list[Article] = []
    sections_acc: dict[str, list[str]] = {}

    for item in edited_payload.get("articles", []):
        article = by_id.get(item.get("id"))
        if not article:
            continue
        article.title = item.get("title") or article.title
        article.dek = item.get("dek") or ""
        article.summary = item.get("summary") or article.summary
        article.byline = item.get("byline") or f"By {article.source}"
        section = item.get("section") or article.category.title()
        article._section = section  # type: ignore[attr-defined]
        if item.get("image_query"):
            image_queries[article.id] = item["image_query"]
        sections_acc.setdefault(section, []).append(article.id)
        ordered.append(article)

    if not ordered:
        ordered = articles

    sections = [{"name": name, "article_ids": ids} for name, ids in sections_acc.items()]
    return ordered, {"image_queries": image_queries, "sections": sections}


def build_plan(
    *,
    paper_title: str,
    template: str,
    max_articles: int,
    company: str | None,
    use_llm: bool,
    config: StudioConfig,
) -> EditionPlan:
    date_label = datetime.now().strftime("%A, %B %d, %Y").replace(" 0", " ")
    articles = collect_articles(limit=max_articles)
    if not articles:
        raise RuntimeError("No articles available. Run npm run agent:news first or check network feeds.")

    client = LLMClient(config.llm)
    if use_llm and client.ready:
        print(f"[studio] LLM edit via {config.llm.model} @ {config.llm.base_url}")
        edited = client.edit_edition(
            paper_title=paper_title,
            date_label=date_label,
            articles=articles,
            company=company,
        )
    else:
        if use_llm and not client.ready:
            print("[studio] LLM_API_KEY missing — using offline desk editor")
        edited = heuristic_edit(
            paper_title=paper_title,
            date_label=date_label,
            articles=articles,
            company=company,
        )

    ordered, meta = _apply_edits(articles, edited)
    ordered = attach_images(ordered, meta["image_queries"])

    return EditionPlan(
        paper_title=paper_title,
        date_label=date_label,
        kicker=edited.get("kicker") or "THE AI TIMES",
        editor_note=edited.get("editor_note") or "Today's strongest stories, tightly edited.",
        weather_line=edited.get("weather_line") or "Good light for reading.",
        sections=meta["sections"],
        articles=ordered,
        template=template,
    )


def generate_edition(
    *,
    template: str = "classic",
    paper_title: str | None = None,
    pages: int = 4,
    max_articles: int = 12,
    company: str | None = None,
    use_llm: bool = True,
    email_to: str | None = None,
    out_dir: Path | None = None,
) -> dict:
    config = StudioConfig()
    template = template or config.default_template
    paper_title = paper_title or config.paper_title
    pages = pages or config.pages
    max_articles = max_articles or config.max_articles

    plan = build_plan(
        paper_title=paper_title,
        template=template,
        max_articles=max_articles,
        company=company,
        use_llm=use_llm,
        config=config,
    )
    html = render_html(plan, template_id=template, pages=pages)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = out_dir or EDITIONS
    html_path = write_edition(html, out_dir / f"{stamp}-{template}.html")
    meta_path = out_dir / f"{stamp}-{template}.json"
    meta_path.write_text(json.dumps(plan.to_dict(), indent=2), encoding="utf-8")

    # Public copy so the web studio can open the paper immediately.
    public_dir = Path(__file__).resolve().parents[2] / "public" / "editions"
    public_dir.mkdir(parents=True, exist_ok=True)
    public_name = f"{stamp}-{template}.html"
    public_path = public_dir / public_name
    public_path.write_text(html, encoding="utf-8")
    latest_path = public_dir / "latest.html"
    latest_path.write_text(html, encoding="utf-8")
    (public_dir / "latest.json").write_text(
        json.dumps(
            {
                "file": f"/editions/{public_name}",
                "latest": "/editions/latest.html",
                "template": template,
                "paper_title": paper_title,
                "generatedAt": datetime.now().isoformat(),
                "articles": len(plan.articles),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"[studio] wrote {html_path}")
    print(f"[studio] public {public_path}")

    result = {
        "html": str(html_path),
        "meta": str(meta_path),
        "publicUrl": f"/editions/{public_name}",
        "latestUrl": "/editions/latest.html",
        "template": template,
        "paper_title": paper_title,
        "articles": len(plan.articles),
        "llm": bool(use_llm and config.llm.enabled),
    }

    if email_to:
        mail = send_edition_email(
            to_email=email_to,
            subject=f"{paper_title} — {plan.date_label}",
            html_path=html_path,
            config=config.email,
        )
        result["email"] = mail

    print("RESULT_JSON=" + json.dumps(result))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate a designed AI Times newspaper edition")
    parser.add_argument("--template", default="classic", choices=sorted(TEMPLATES_META.keys()))
    parser.add_argument("--list-templates", action="store_true")
    parser.add_argument("--title", default=None, help="Masthead / paper title")
    parser.add_argument("--company", default=None, help="Company focus keywords/name")
    parser.add_argument("--pages", type=int, default=4)
    parser.add_argument("--max-articles", type=int, default=12)
    parser.add_argument("--no-llm", action="store_true", help="Skip model calls; use offline editor")
    parser.add_argument("--email", default=None, help="Send finished edition to this address")
    parser.add_argument("--all-templates", action="store_true", help="Render every ready-made template")
    args = parser.parse_args(argv)

    if args.list_templates:
        for key, meta in list_templates().items():
            print(f"{key:12}  {meta['name']} — {meta['description']}")
        return 0

    templates = list(TEMPLATES_META) if args.all_templates else [args.template]
    for template in templates:
        result = generate_edition(
            template=template,
            paper_title=args.title,
            pages=args.pages,
            max_articles=args.max_articles,
            company=args.company,
            use_llm=not args.no_llm,
            email_to=args.email if template == templates[-1] else None,
        )
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
