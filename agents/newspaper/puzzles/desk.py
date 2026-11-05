from __future__ import annotations

import html
import random
from datetime import date
from typing import Any

from .catalog import DEFAULT_PUZZLES, PUZZLE_CATALOG, PuzzleDifficulty, PuzzleType
from .generators import GENERATORS
from .seed import day_key, fingerprint, is_used, mark_used, rng_seed


def build_daily_puzzles(
    *,
    kinds: list[str] | None = None,
    difficulty: PuzzleDifficulty = "medium",
    day: date | None = None,
    record: bool = True,
) -> list[dict[str, Any]]:
    """Build unique-for-the-day puzzles. Never repeats a prior fingerprint."""
    day_s = day_key(day)
    selected: list[str] = []
    for k in kinds or DEFAULT_PUZZLES:
        if k in PUZZLE_CATALOG and k not in selected:
            selected.append(k)
    if not selected:
        selected = list(DEFAULT_PUZZLES)

    puzzles: list[dict[str, Any]] = []
    fps: list[str] = []
    for kind in selected:
        gen = GENERATORS[kind]
        puzzle = None
        fp = ""
        for salt in range(0, 80):
            rng = random.Random(rng_seed(day_s, kind, difficulty, salt=salt))
            candidate = gen(rng, difficulty)
            candidate["id"] = f"{kind}-{day_s}-{difficulty}-{salt}"
            candidate["date"] = day_s
            # Fingerprint ignores volatile ids
            core = {k: v for k, v in candidate.items() if k not in {"id"}}
            fp = fingerprint({"kind": kind, "difficulty": difficulty, "body": core})
            if not is_used(fp):
                puzzle = candidate
                break
        if puzzle is None:
            # Last resort: accept with extra entropy marker
            rng = random.Random(rng_seed(day_s, kind, difficulty, salt=999))
            puzzle = gen(rng, difficulty)
            puzzle["id"] = f"{kind}-{day_s}-{difficulty}-x"
            puzzle["date"] = day_s
            fp = fingerprint({"kind": kind, "difficulty": difficulty, "body": puzzle, "x": day_s})
        puzzle["fingerprint"] = fp
        puzzles.append(puzzle)
        fps.append(fp)

    if record:
        mark_used(fps, day=day_s, kinds=selected)
    return puzzles


def _cell(ch: str) -> str:
    if ch == "#":
        return '<td class="blk"></td>'
    if ch == "" or ch == "0" or ch == 0:
        return '<td class="open">&nbsp;</td>'
    return f'<td class="open">{html.escape(str(ch))}</td>'


def _sudoku_table(grid: list[list[int]]) -> str:
    rows = []
    for r, row in enumerate(grid):
        cells = []
        for c, val in enumerate(row):
            thick = []
            if c % 3 == 0:
                thick.append("l")
            if r % 3 == 0:
                thick.append("t")
            if c == 8:
                thick.append("r")
            if r == 8:
                thick.append("b")
            cls = " ".join(["s", *thick])
            cells.append(f'<td class="{cls}">{"" if not val else val}</td>')
        rows.append("<tr>" + "".join(cells) + "</tr>")
    return '<table class="sudoku">' + "".join(rows) + "</table>"


def render_puzzle_block(puzzle: dict[str, Any]) -> str:
    kind = puzzle["type"]
    title = html.escape(puzzle.get("title") or kind.title())
    diff = html.escape(str(puzzle.get("difficulty", "medium")).title())
    instructions = html.escape(puzzle.get("instructions") or "")
    head = f'<div class="pz-head"><h2>{title}</h2><span class="diff">{diff}</span></div><p class="hint">{instructions}</p>'

    if kind == "sudoku":
        return f'<section class="pz">{head}{_sudoku_table(puzzle["grid"])}</section>'

    if kind == "crossword":
        size = puzzle["size"]
        numbers = puzzle.get("numbers") or {}
        rows = []
        for r in range(size):
            cells = []
            for c in range(size):
                ch = puzzle["grid"][r][c]
                key = f"{r},{c}"
                num = numbers.get(key)
                if ch == "#":
                    cells.append('<td class="blk"></td>')
                else:
                    badge = f'<sup>{num}</sup>' if num else ""
                    cells.append(f'<td class="open">{badge}&nbsp;</td>')
            rows.append("<tr>" + "".join(cells) + "</tr>")
        clues = "".join(
            f'<div><strong>{html.escape(str(c["num"]))}.</strong> {html.escape(c["clue"])}</div>'
            for c in (puzzle.get("clues") or {}).get("across") or []
        )
        table = '<table class="cross">' + "".join(rows) + "</table>"
        return f'<section class="pz">{head}<div class="cross-wrap">{table}<div class="clues"><h3>Across</h3>{clues}</div></div></section>'

    if kind == "wordsearch":
        rows = []
        for row in puzzle["grid"]:
            rows.append("<tr>" + "".join(f"<td>{html.escape(ch)}</td>" for ch in row) + "</tr>")
        words = ", ".join(html.escape(w) for w in puzzle.get("words") or [])
        return (
            f'<section class="pz">{head}'
            f'<table class="wsearch">{"".join(rows)}</table>'
            f'<p class="wordlist"><strong>Find:</strong> {words}</p></section>'
        )

    if kind == "cryptogram":
        cipher = html.escape(puzzle.get("cipher") or "")
        hints = puzzle.get("hints") or {}
        hint_html = ""
        if hints:
            bits = [f"{html.escape(k)}→{html.escape(v)}" for k, v in hints.items()]
            hint_html = "<p class='wordlist'><strong>Hints:</strong> " + ", ".join(bits) + "</p>"
        return f'<section class="pz">{head}<p class="cipher">{cipher}</p>{hint_html}</section>'

    if kind == "trivia":
        blocks = []
        for i, q in enumerate(puzzle.get("questions") or [], start=1):
            choices = "".join(
                f"<li>{html.escape(chr(65 + idx))}. {html.escape(ch)}</li>"
                for idx, ch in enumerate(q.get("choices") or [])
            )
            blocks.append(
                f"<div class='tq'><div class='tq-q'>{i}. {html.escape(q['q'])}</div><ul>{choices}</ul></div>"
            )
        return f'<section class="pz">{head}{"".join(blocks)}</section>'

    return f'<section class="pz">{head}<p>Puzzle unavailable.</p></section>'


def render_solutions(puzzles: list[dict[str, Any]]) -> str:
    parts = ['<section class="pz solutions"><h2>Solutions</h2><p class="hint">No peeking until you try.</p>']
    for puzzle in puzzles:
        kind = puzzle["type"]
        title = html.escape(puzzle.get("title") or kind)
        if kind == "sudoku":
            parts.append(f"<h3>{title}</h3>{_sudoku_table(puzzle['solution'])}")
        elif kind == "crossword":
            rows = []
            for row in puzzle["solution"]:
                rows.append("<tr>" + "".join(_cell(ch) for ch in row) + "</tr>")
            parts.append(f"<h3>{title}</h3><table class='cross'>{''.join(rows)}</table>")
        elif kind == "wordsearch":
            words = ", ".join(html.escape(w) for w in puzzle.get("words") or [])
            parts.append(f"<h3>{title}</h3><p>{words}</p>")
        elif kind == "cryptogram":
            parts.append(f"<h3>{title}</h3><p class='cipher'>{html.escape(puzzle.get('solution') or '')}</p>")
        elif kind == "trivia":
            ans = "; ".join(
                f"{i}. {html.escape(q.get('answer') or '')}"
                for i, q in enumerate(puzzle.get("questions") or [], start=1)
            )
            parts.append(f"<h3>{title}</h3><p>{ans}</p>")
    parts.append("</section>")
    return "".join(parts)


PUZZLE_CSS = """
.pz-page {
  width:210mm; min-height:297mm; margin:6mm auto; background:#fbfaf6;
  padding:7mm 8mm 8mm; page-break-after:always; box-shadow:0 12px 32px rgba(0,0,0,.12);
  display:flex; flex-direction:column;
}
.pz-page h1.game-mast, .pz-page h1.games-mast {
  font:700 15pt Georgia,serif; margin:0 0 1.5mm; letter-spacing:-.02em;
}
.pz-page .sub {
  font:600 7.5pt/1.2 sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#666;
  border-bottom:2pt solid #111; padding-bottom:1.5mm; margin-bottom:3mm;
}
.pz-grid {
  display:grid; grid-template-columns:1fr 1fr; gap:3mm 3.5mm; align-content:start; flex:1 1 auto;
}
.pz-grid .pz-wide { grid-column:1 / -1; }
.pz {
  margin:0; padding:2.2mm 2.4mm; border:0.55pt solid #d5d1c7; background:#fff; break-inside:avoid;
}
.pz-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
.pz h2 { font:700 11pt Georgia,serif; margin:0; }
.pz h3 { font:700 9pt Georgia,serif; margin:2mm 0 1mm; }
.diff { font:700 7pt/1 sans-serif; letter-spacing:.1em; text-transform:uppercase; color:#0071e3; }
.hint { font: italic 8pt/1.3 Georgia,serif; color:#555; margin:1mm 0 2mm; }
table.sudoku, table.cross, table.wsearch { border-collapse:collapse; margin:0 auto 1.2mm; }
table.sudoku td { width:6mm; height:6mm; border:0.35pt solid #999; text-align:center; font:700 8.5pt/1 Georgia,serif; }
table.sudoku td.l { border-left:1.4pt solid #111; }
table.sudoku td.t { border-top:1.4pt solid #111; }
table.sudoku td.r { border-right:1.4pt solid #111; }
table.sudoku td.b { border-bottom:1.4pt solid #111; }
table.cross td { width:4.2mm; height:4.2mm; border:0.3pt solid #333; vertical-align:top; font:6.5pt/1 sans-serif; }
table.cross td.blk { background:#222; border-color:#222; }
table.cross td.open { background:#fff; }
table.cross sup { font-size:5pt; margin-left:0.3mm; }
.cross-wrap { display:grid; grid-template-columns:1.05fr 0.95fr; gap:3mm; }
.clues { font:8pt/1.3 Georgia,serif; }
.clues div { margin:0 0 0.9mm; }
table.wsearch td { width:4mm; height:4mm; border:0.25pt solid #ccc; text-align:center; font:700 6.5pt/1 ui-monospace,monospace; }
.wordlist { font:8pt/1.3 Georgia,serif; margin:1.2mm 0 0; }
.cipher { font:700 9pt/1.4 ui-monospace,monospace; letter-spacing:.06em; word-break:break-word; }
.tq { margin:0 0 1.6mm; }
.tq-q { font:700 8.5pt/1.25 Georgia,serif; margin-bottom:0.4mm; }
.tq ul { margin:0; padding-left:3.5mm; font:8pt/1.25 Georgia,serif; }
.solutions { border-top:1.6pt solid #111; padding-top:2.5mm; margin-top:auto; }
.solutions h2 { font:700 11pt Georgia,serif; margin:0 0 2mm; }
.solutions h3 { font:700 9pt Georgia,serif; margin:1.5mm 0 1mm; }
.sol-grid { display:grid; grid-template-columns:1fr 1fr; gap:2.5mm 3mm; }
@media print { .pz-page { box-shadow:none; margin:0; } }
@media screen and (max-width:820px) {
  .pz-page { width:100%; min-height:auto; margin:0; box-shadow:none; padding:5vw; }
  .pz-grid, .cross-wrap, .sol-grid { grid-template-columns:1fr; }
}
"""


def render_puzzles_html(
    puzzles: list[dict[str, Any]],
    *,
    paper_title: str,
    date_label: str,
) -> str:
    if not puzzles:
        return ""

    wide = {"crossword"}

    def weight(p: dict[str, Any]) -> int:
        return 2 if p.get("type") in wide else 1

    # Pack densely: ~4 weight units per A4 games page (no lonely half-empty sheets).
    pages: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    load = 0
    for puzzle in puzzles:
        w = weight(puzzle)
        if current and load + w > 4:
            pages.append(current)
            current, load = [], 0
        current.append(puzzle)
        load += w
    if current:
        pages.append(current)

    pages_html: list[str] = []
    for items in pages:
        blocks: list[str] = []
        for p in items:
            block = render_puzzle_block(p)
            if p.get("type") in wide:
                block = block.replace('class="pz"', 'class="pz pz-wide"', 1).replace(
                    'class="pz ', 'class="pz pz-wide ', 1
                )
            blocks.append(block)
        pages_html.append(
            f'<section class="page pz-page">'
            f'<div class="sub">Games desk · {html.escape(date_label)} · New today · dense A4</div>'
            f'<h1 class="game-mast">{html.escape(paper_title)} Games</h1>'
            f'<div class="pz-grid">{"".join(blocks)}</div>'
            f"</section>"
        )

    sol = render_solutions(puzzles)
    # Always tuck solutions onto the last games page so we never ship a half-blank solutions sheet.
    if pages_html:
        pages_html[-1] = pages_html[-1].replace(
            "</section>",
            f'<div class="sol-grid">{sol}</div></section>',
            1,
        )
    else:
        pages_html.append(
            f'<section class="page pz-page">'
            f'<div class="sub">Games desk · Solutions · {html.escape(date_label)}</div>'
            f'<h1 class="game-mast">{html.escape(paper_title)} Games</h1>'
            f'<div class="sol-grid">{sol}</div></section>'
        )

    style = f"<style id='ait-puzzles'>{PUZZLE_CSS}</style>"
    return style + "".join(pages_html)


def catalog_public() -> dict[str, Any]:
    return {
        "puzzles": [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in PUZZLE_CATALOG.items()
        ],
        "difficulties": ["easy", "medium", "hard"],
        "defaults": list(DEFAULT_PUZZLES),
    }
