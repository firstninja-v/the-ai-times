"""Daily newspaper puzzle desk — unique games every day."""

from .catalog import PUZZLE_CATALOG, PuzzleDifficulty, PuzzleType
from .desk import build_daily_puzzles, render_puzzles_html

__all__ = [
    "PUZZLE_CATALOG",
    "PuzzleDifficulty",
    "PuzzleType",
    "build_daily_puzzles",
    "render_puzzles_html",
]
