from __future__ import annotations

from typing import Literal

PuzzleType = Literal["crossword", "sudoku", "wordsearch", "cryptogram", "trivia"]
PuzzleDifficulty = Literal["easy", "medium", "hard"]

PUZZLE_CATALOG: dict[str, dict[str, str]] = {
    "crossword": {
        "name": "Mini Crossword",
        "description": "Classic across/down clues — a newspaper staple.",
    },
    "sudoku": {
        "name": "Sudoku",
        "description": "Fill 1–9 so every row, column, and box is unique.",
    },
    "wordsearch": {
        "name": "Word Search",
        "description": "Find hidden words in the letter grid.",
    },
    "cryptogram": {
        "name": "Cryptogram",
        "description": "Decode a quotation letter by letter.",
    },
    "trivia": {
        "name": "Daily Trivia",
        "description": "Five fresh questions from world, science, and culture.",
    },
}

DEFAULT_PUZZLES: list[PuzzleType] = ["crossword", "sudoku", "wordsearch"]
