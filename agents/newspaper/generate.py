from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from .config import EDITIONS, StudioConfig, TEMPLATES_META
from .design import FONTS, apply_design
from .emailer import send_edition_email
from .fetch import collect_articles
from .images import attach_images
from .llm import LLMClient, heuristic_edit
from .models import Article, EditionPlan
from .puzzles.catalog import DEFAULT_PUZZLES
from .puzzles.desk import build_daily_puzzles, render_puzzles_html
from .puzzles.seed import mark_used, used_article_ids
from .render import list_templates, render_html, write_edition
from .volume import resolve_volume


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
        article.body = item.get("body") or item.get("summary") or article.summary
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
    news_prompt: str | None = None,
    content_volume: str = "more",
) -> EditionPlan:
    volume = resolve_volume(content_volume)
    max_articles = max(max_articles, int(volume["max_articles"]))
    date_label = datetime.now().strftime("%A, %B %d, %Y").replace(" 0", " ")
    articles = collect_articles(limit=max_articles, exclude_ids=used_article_ids())
    if not articles:
        raise RuntimeError("No articles available. Run npm run agent:news first or check network feeds.")

    # Soft-rank by prompt tokens before LLM edit.
    if news_prompt:
        tokens = [t for t in news_prompt.lower().replace(",", " ").split() if len(t) > 3]
        for article in articles:
            blob = f"{article.title} {article.summary}".lower()
            article.score += sum(1.5 for t in tokens if t in blob)

    client = LLMClient(config.llm)
    edited = None
    llm_used = False
    if use_llm and client.ready:
        print(f"[studio] LLM edit via {config.llm.model} @ {config.llm.base_url}")
        try:
            edited = client.edit_edition(
                paper_title=paper_title,
                date_label=date_label,
                articles=articles,
                company=company or news_prompt,
                volume_id=volume["id"],
                body_sentences=int(volume["body_sentences"]),
            )
            llm_used = True
        except Exception as exc:  # noqa: BLE001
            print(f"[studio] LLM failed ({exc}) — falling back to offline desk editor")
    if edited is None:
        if use_llm and not client.ready:
            print("[studio] LLM_API_KEY missing — using offline desk editor")
        edited = heuristic_edit(
            paper_title=paper_title,
            date_label=date_label,
            articles=articles,
            company=company or news_prompt,
            volume=volume,
        )

    ordered, meta = _apply_edits(articles, edited)
    # Ensure every story has expandable reading matter at the chosen volume.
    from .volume import expand_body

    for article in ordered:
        if not article.body or len(article.body) < 120:
            article.body = expand_body(
                article.title,
                article.summary or article.body,
                source=article.source,
                category=article.category,
                volume=volume,
            )
    ordered = attach_images(ordered, meta["image_queries"])

    plan = EditionPlan(
        paper_title=paper_title,
        date_label=date_label,
        kicker=edited.get("kicker") or "THE AI TIMES",
        editor_note=edited.get("editor_note") or "Today's strongest stories, tightly edited.",
        weather_line=edited.get("weather_line") or "Good light for reading.",
        sections=meta["sections"],
        articles=ordered,
        template=template,
    )
    plan._llm_used = llm_used  # type: ignore[attr-defined]
    plan._volume = volume  # type: ignore[attr-defined]
    return plan


def generate_edition(
    *,
    template: str = "classic",
    paper_title: str | None = None,
    pages: int = 4,
    max_articles: int = 18,
    company: str | None = None,
    use_llm: bool = True,
    email_to: str | None = None,
    out_dir: Path | None = None,
    news_prompt: str | None = None,
    font: str = "georgia",
    color_mode: str = "color",
    puzzles: list[str] | None = None,
    puzzle_difficulty: str = "medium",
    include_puzzles: bool = True,
    content_volume: str = "more",
) -> dict:
    config = StudioConfig()
    template = template or config.default_template
    paper_title = paper_title or config.paper_title
    pages = pages or config.pages
    volume = resolve_volume(content_volume)
    max_articles = max(max_articles or 0, int(volume["max_articles"]))
    if font not in FONTS:
        font = "georgia"
    if color_mode not in {"bw", "color"}:
        color_mode = "color"
    if puzzle_difficulty not in {"easy", "medium", "hard"}:
        puzzle_difficulty = "medium"

    plan = build_plan(
        paper_title=paper_title,
        template=template,
        max_articles=max_articles,
        company=company,
        use_llm=use_llm,
        config=config,
        news_prompt=news_prompt,
        content_volume=volume["id"],
    )
    html = render_html(
        plan,
        template_id=template,
        pages=pages,
        per_page=int(volume["per_page"]),
        show_images=int(volume["show_images"]),
    )

    puzzle_payload: list[dict] = []
    if include_puzzles:
        kinds = puzzles if puzzles is not None else list(DEFAULT_PUZZLES)
        if kinds:
            puzzle_payload = build_daily_puzzles(
                kinds=kinds,
                difficulty=puzzle_difficulty,  # type: ignore[arg-type]
                record=False,
            )
            puzzle_html = render_puzzles_html(
                puzzle_payload,
                paper_title=paper_title,
                date_label=plan.date_label,
            )
            if "</body>" in html:
                html = html.replace("</body>", puzzle_html + "</body>", 1)
            else:
                html += puzzle_html

    # Remember puzzles + article ids so tomorrow's paper never repeats them.
    mark_used(
        [p["fingerprint"] for p in puzzle_payload if p.get("fingerprint")],
        day=datetime.now().strftime("%Y-%m-%d"),
        kinds=[p.get("type") for p in puzzle_payload if p.get("type")],
        article_ids=[a.id for a in plan.articles],
    )

    html = apply_design(html, font=font, color_mode=color_mode, pages=pages)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = out_dir or EDITIONS
    html_path = write_edition(html, out_dir / f"{stamp}-{template}.html")
    meta_path = out_dir / f"{stamp}-{template}.json"
    meta_blob = plan.to_dict()
    meta_blob["puzzles"] = [
        {"id": p.get("id"), "type": p.get("type"), "difficulty": p.get("difficulty"), "title": p.get("title")}
        for p in puzzle_payload
    ]
    meta_path.write_text(json.dumps(meta_blob, indent=2), encoding="utf-8")

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
                "puzzles": [p.get("type") for p in puzzle_payload],
                "puzzleDifficulty": puzzle_difficulty,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"[studio] wrote {html_path}")
    print(f"[studio] public {public_path}")
    if puzzle_payload:
        print(f"[studio] puzzles: {', '.join(p['type'] for p in puzzle_payload)} @ {puzzle_difficulty}")

    result = {
        "html": str(html_path),
        "meta": str(meta_path),
        "publicUrl": f"/editions/{public_name}",
        "latestUrl": "/editions/latest.html",
        "template": template,
        "paper_title": paper_title,
        "articles": len(plan.articles),
        "pages": pages,
        "font": font,
        "color_mode": color_mode,
        "puzzles": [p.get("type") for p in puzzle_payload],
        "puzzleDifficulty": puzzle_difficulty,
        "contentVolume": volume["id"],
        "llm": bool(getattr(plan, "_llm_used", False)),
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
    parser.add_argument("--max-articles", type=int, default=18)
    parser.add_argument("--no-llm", action="store_true", help="Skip model calls; use offline editor")
    parser.add_argument("--email", default=None, help="Send finished edition to this address")
    parser.add_argument("--prompt", default=None, help="Natural-language news desk prompt")
    parser.add_argument("--font", default="georgia", choices=sorted(FONTS.keys()))
    parser.add_argument("--color", default="color", choices=["bw", "color"])
    parser.add_argument("--all-templates", action="store_true", help="Render every ready-made template")
    parser.add_argument(
        "--puzzles",
        default="crossword,sudoku,wordsearch",
        help="Comma list: crossword,sudoku,wordsearch,cryptogram,trivia (or 'none')",
    )
    parser.add_argument("--puzzle-difficulty", default="medium", choices=["easy", "medium", "hard"])
    parser.add_argument(
        "--volume",
        default="more",
        choices=["less", "medium", "more"],
        help="How much reading matter: less / medium / more",
    )
    args = parser.parse_args(argv)

    if args.list_templates:
        for key, meta in list_templates().items():
            print(f"{key:12}  {meta['name']} — {meta['description']}")
        return 0

    if args.puzzles.strip().lower() in {"", "none", "off", "false"}:
        puzzle_kinds: list[str] | None = []
        include_puzzles = False
    else:
        puzzle_kinds = [p.strip() for p in args.puzzles.split(",") if p.strip()]
        include_puzzles = True

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
            news_prompt=args.prompt,
            font=args.font,
            color_mode=args.color,
            puzzles=puzzle_kinds,
            puzzle_difficulty=args.puzzle_difficulty,
            include_puzzles=include_puzzles,
            content_volume=args.volume,
        )
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
