from __future__ import annotations

import random
import string
from typing import Any

from .catalog import PuzzleDifficulty

# --- Word banks ---

CROSSWORD_BANK = [
    ("AI", "Machine smarts, briefly"),
    ("INK", "Newspaper blood"),
    ("EDIT", "Desk work"),
    ("NEWS", "What this paper prints"),
    ("WIRE", "Press feed"),
    ("PRESS", "Fourth estate"),
    ("STORY", "Column unit"),
    ("BYLINE", "Author credit"),
    ("MASTHEAD", "Paper's top title"),
    ("HEADLINE", "Biggest type on the page"),
    ("BROADSHEET", "Large-format paper"),
    ("DATELINE", "Where/when a story began"),
    ("OPED", "Opinion page, briefly"),
    ("SCOOP", "Exclusive story"),
    ("DEK", "Subhead under a title"),
    ("LEAD", "Top story"),
    ("COPY", "Written text"),
    ("FONT", "Typeface"),
    ("PAGE", "Printed leaf"),
    ("DAILY", "Every-morning paper"),
    ("WORLD", "International desk"),
    ("MARKET", "Business beat"),
    ("SCIENCE", "Lab desk"),
    ("SPORTS", "Games desk"),
    ("CLIMATE", "Weather + planet beat"),
    ("CRYPTO", "Encoded puzzle kin"),
    ("SUDOKU", "Number grid game"),
    ("TRIVIA", "Quiz fare"),
    ("PUZZLE", "Games page fare"),
    ("MORNING", "Delivery ritual hour"),
]

WORDSEARCH_THEMES = {
    "easy": ["NEWS", "INK", "PAGE", "EDIT", "WIRE", "LEAD", "COPY", "FONT"],
    "medium": ["HEADLINE", "BYLINE", "MASTHEAD", "DATELINE", "PRESS", "STORY", "SCOOP", "DEK", "OPED"],
    "hard": [
        "BROADSHEET",
        "NEWSROOM",
        "TYPESCRIPT",
        "JOURNALISM",
        "FRONT PAGE",
        "CITYDESK",
        "DEADLINE",
        "PRESSRUN",
        "COLUMNIST",
        "REPORTER",
    ],
}

CRYPTO_QUOTES = [
    "The pen is mightier than the sword.",
    "All the news that fits we print with care.",
    "Seek truth and report it plainly.",
    "A free press is the soul of liberty.",
    "Read slowly; think clearly; write cleanly.",
    "Curiosity is the first draft of wisdom.",
    "Today's rumor is tomorrow's correction.",
    "Ink remembers what memory forgets.",
    "Ask again until the answer is honest.",
    "Small facts build large truths.",
    "Silence is not a source.",
    "Clarity is kindness to the reader.",
    "The best headline earns its size.",
    "Doubt is a reporter's best tool.",
    "Morning light favors careful reading.",
    "Cut the noise; keep the signal.",
    "Every edition is a fresh chance.",
    "Sources matter more than speed alone.",
    "Precision beats volume on the page.",
    "A paper without questions is blank.",
]

TRIVIA_BANK = [
    {"q": "Which planet is known as the Red Planet?", "choices": ["Venus", "Mars", "Jupiter", "Mercury"], "a": 1},
    {"q": "Who wrote 'Pride and Prejudice'?", "choices": ["Charlotte Brontë", "Jane Austen", "Mary Shelley", "George Eliot"], "a": 1},
    {"q": "What does HTTP stand for?", "choices": ["HyperText Transfer Protocol", "High Transfer Text Path", "Host Transfer Type Process", "Hyperlink Text Tracking Protocol"], "a": 0},
    {"q": "Which ocean is the largest?", "choices": ["Atlantic", "Indian", "Arctic", "Pacific"], "a": 3},
    {"q": "In what year did the first modern Olympic Games take place?", "choices": ["1896", "1900", "1912", "1924"], "a": 0},
    {"q": "What element has the chemical symbol Au?", "choices": ["Silver", "Argon", "Gold", "Aluminum"], "a": 2},
    {"q": "Which country gifted the Statue of Liberty to the USA?", "choices": ["Spain", "France", "Italy", "England"], "a": 1},
    {"q": "How many players are on a soccer team on the field?", "choices": ["9", "10", "11", "12"], "a": 2},
    {"q": "What is the capital of Japan?", "choices": ["Osaka", "Kyoto", "Tokyo", "Nagoya"], "a": 2},
    {"q": "Which gas do plants absorb from the atmosphere?", "choices": ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], "a": 2},
    {"q": "Who painted the Mona Lisa?", "choices": ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], "a": 2},
    {"q": "What is the smallest prime number?", "choices": ["0", "1", "2", "3"], "a": 2},
    {"q": "Which instrument has 88 keys?", "choices": ["Harp", "Organ", "Piano", "Accordion"], "a": 2},
    {"q": "What does CPU stand for?", "choices": ["Central Processing Unit", "Computer Power Utility", "Core Program Umbrella", "Central Program Unit"], "a": 0},
    {"q": "Which desert is the largest hot desert?", "choices": ["Gobi", "Sahara", "Kalahari", "Mojave"], "a": 1},
    {"q": "How many continents are there?", "choices": ["5", "6", "7", "8"], "a": 2},
    {"q": "What language is the most spoken natively worldwide?", "choices": ["English", "Spanish", "Mandarin Chinese", "Hindi"], "a": 2},
    {"q": "Which blood type is known as the universal donor?", "choices": ["A", "B", "AB", "O negative"], "a": 3},
    {"q": "What is the boiling point of water at sea level in Celsius?", "choices": ["90", "95", "100", "110"], "a": 2},
    {"q": "Who developed the theory of general relativity?", "choices": ["Newton", "Einstein", "Bohr", "Maxwell"], "a": 1},
    {"q": "Which Shakespeare play features the characters Rosencrantz and Guildenstern?", "choices": ["Macbeth", "Hamlet", "Othello", "King Lear"], "a": 1},
    {"q": "What is the currency of the United Kingdom?", "choices": ["Euro", "Dollar", "Pound sterling", "Franc"], "a": 2},
    {"q": "Which organ produces insulin?", "choices": ["Liver", "Pancreas", "Kidney", "Spleen"], "a": 1},
    {"q": "In computing, what does RAM stand for?", "choices": ["Random Access Memory", "Readily Available Memory", "Rapid Application Module", "Runtime Allocation Map"], "a": 0},
    {"q": "Which mountain is the tallest above sea level?", "choices": ["K2", "Kangchenjunga", "Everest", "Lhotse"], "a": 2},
]


def _size_for(difficulty: PuzzleDifficulty) -> dict[str, int]:
    if difficulty == "easy":
        return {"sudoku_holes": 36, "grid": 10, "cross": 5, "trivia": 5}
    if difficulty == "hard":
        return {"sudoku_holes": 54, "grid": 14, "cross": 8, "trivia": 5}
    return {"sudoku_holes": 45, "grid": 12, "cross": 6, "trivia": 5}


# ---------- Sudoku ----------

def _sudoku_find_empty(board: list[list[int]]) -> tuple[int, int] | None:
    for r in range(9):
        for c in range(9):
            if board[r][c] == 0:
                return r, c
    return None


def _sudoku_valid(board: list[list[int]], r: int, c: int, n: int) -> bool:
    if n in board[r]:
        return False
    if n in [board[i][c] for i in range(9)]:
        return False
    br, bc = 3 * (r // 3), 3 * (c // 3)
    for i in range(br, br + 3):
        for j in range(bc, bc + 3):
            if board[i][j] == n:
                return False
    return True


def _sudoku_solve(board: list[list[int]], rng: random.Random) -> bool:
    empty = _sudoku_find_empty(board)
    if not empty:
        return True
    r, c = empty
    nums = list(range(1, 10))
    rng.shuffle(nums)
    for n in nums:
        if _sudoku_valid(board, r, c, n):
            board[r][c] = n
            if _sudoku_solve(board, rng):
                return True
            board[r][c] = 0
    return False


def generate_sudoku(rng: random.Random, difficulty: PuzzleDifficulty) -> dict[str, Any]:
    board = [[0] * 9 for _ in range(9)]
    _sudoku_solve(board, rng)
    solution = [row[:] for row in board]
    holes = _size_for(difficulty)["sudoku_holes"]
    cells = [(r, c) for r in range(9) for c in range(9)]
    rng.shuffle(cells)
    puzzle = [row[:] for row in board]
    for r, c in cells[:holes]:
        puzzle[r][c] = 0
    return {
        "type": "sudoku",
        "title": "Sudoku",
        "difficulty": difficulty,
        "grid": puzzle,
        "solution": solution,
        "instructions": "Fill empty cells so every row, column, and 3×3 box contains 1–9 exactly once.",
    }


# ---------- Crossword (mini) ----------

def generate_crossword(rng: random.Random, difficulty: PuzzleDifficulty) -> dict[str, Any]:
    count = _size_for(difficulty)["cross"]
    pool = CROSSWORD_BANK[:]
    rng.shuffle(pool)
    selected = pool[:count]
    # Place words simply: first across on row 0, rest down from col 0-ish or staggered
    size = max(8, max(len(w) for w, _ in selected) + 1)
    grid = [["#" for _ in range(size)] for _ in range(size)]
    clues_across = []
    clues_down = []
    # Place longest across at top
    selected.sort(key=lambda x: len(x[0]), reverse=True)
    word0, clue0 = selected[0]
    for i, ch in enumerate(word0):
        grid[0][i] = ch
    clues_across.append({"num": 1, "clue": clue0, "answer": word0, "row": 0, "col": 0})

    num = 2
    row = 1
    for word, clue in selected[1:]:
        col = rng.randint(0, max(0, size - len(word)))
        if row >= size:
            break
        # clear row for word
        for i, ch in enumerate(word):
            if col + i >= size:
                break
            grid[row][col + i] = ch
        clues_across.append({"num": num, "clue": clue, "answer": word, "row": row, "col": col})
        num += 1
        row += 1 + (1 if difficulty == "hard" else 0)

    # Build display grid with blanks (letters → empty for solving except we show structure)
    display = []
    for r in range(size):
        drow = []
        for c in range(size):
            ch = grid[r][c]
            if ch == "#":
                # keep as block if neighbors empty-ish
                drow.append("#")
            else:
                drow.append("")  # blank for solver
        display.append(drow)

    # Number cells that start clues
    numbers: dict[str, int] = {}
    for item in clues_across:
        numbers[f"{item['row']},{item['col']}"] = item["num"]

    return {
        "type": "crossword",
        "title": "Mini Crossword",
        "difficulty": difficulty,
        "size": size,
        "grid": display,
        "solution": grid,
        "numbers": numbers,
        "clues": {"across": clues_across, "down": clues_down},
        "instructions": "Fill the white squares using the clues. Answers run across.",
    }


# ---------- Word search ----------

def generate_wordsearch(rng: random.Random, difficulty: PuzzleDifficulty) -> dict[str, Any]:
    words = [w.replace(" ", "") for w in WORDSEARCH_THEMES[difficulty]]
    rng.shuffle(words)
    n = _size_for(difficulty)["grid"]
    grid = [["" for _ in range(n)] for _ in range(n)]
    placed = []
    directions = [(0, 1), (1, 0), (1, 1), (-1, 1), (0, -1), (-1, 0)]

    def can_place(word: str, r: int, c: int, dr: int, dc: int) -> bool:
        for i, ch in enumerate(word):
            rr, cc = r + dr * i, c + dc * i
            if not (0 <= rr < n and 0 <= cc < n):
                return False
            existing = grid[rr][cc]
            if existing and existing != ch:
                return False
        return True

    def place(word: str, r: int, c: int, dr: int, dc: int) -> None:
        for i, ch in enumerate(word):
            grid[r + dr * i][c + dc * i] = ch

    for word in words:
        done = False
        for _ in range(80):
            dr, dc = rng.choice(directions)
            r = rng.randint(0, n - 1)
            c = rng.randint(0, n - 1)
            if can_place(word, r, c, dr, dc):
                place(word, r, c, dr, dc)
                placed.append(word)
                done = True
                break
        if not done:
            continue

    alphabet = string.ascii_uppercase
    for r in range(n):
        for c in range(n):
            if not grid[r][c]:
                grid[r][c] = rng.choice(alphabet)

    return {
        "type": "wordsearch",
        "title": "Word Search",
        "difficulty": difficulty,
        "grid": grid,
        "words": placed,
        "instructions": "Circle each listed word. Words may run in any direction.",
    }


# ---------- Cryptogram ----------

def generate_cryptogram(rng: random.Random, difficulty: PuzzleDifficulty) -> dict[str, Any]:
    quote = rng.choice(CRYPTO_QUOTES)
    letters = [c for c in string.ascii_uppercase]
    cipher_letters = letters[:]
    # Ensure no letter maps to itself for medium/hard
    for _ in range(40):
        rng.shuffle(cipher_letters)
        mapping = dict(zip(letters, cipher_letters))
        if difficulty == "easy":
            break
        if all(mapping[a] != a for a in letters):
            break
    encoded = []
    for ch in quote.upper():
        if ch in mapping:
            encoded.append(mapping[ch])
        else:
            encoded.append(ch)
    hint_count = 3 if difficulty == "easy" else 1 if difficulty == "medium" else 0
    hints = {}
    plain_letters = sorted({c for c in quote.upper() if c.isalpha()})
    rng.shuffle(plain_letters)
    for p in plain_letters[:hint_count]:
        hints[mapping[p]] = p
    return {
        "type": "cryptogram",
        "title": "Cryptogram",
        "difficulty": difficulty,
        "cipher": "".join(encoded),
        "solution": quote.upper(),
        "hints": hints,
        "instructions": "Each letter stands for another. Apostrophes and punctuation stay.",
    }


# ---------- Trivia ----------

def generate_trivia(rng: random.Random, difficulty: PuzzleDifficulty) -> dict[str, Any]:
    pool = TRIVIA_BANK[:]
    rng.shuffle(pool)
    count = _size_for(difficulty)["trivia"]
    # Hard: shuffle choices more aggressively / pick harder slice
    if difficulty == "hard":
        pool = pool[len(pool) // 3 :] + pool[: len(pool) // 3]
        rng.shuffle(pool)
    questions = []
    for item in pool[:count]:
        choices = item["choices"][:]
        answer = choices[item["a"]]
        if difficulty != "easy":
            rng.shuffle(choices)
            ans_idx = choices.index(answer)
        else:
            ans_idx = item["a"]
        questions.append({"q": item["q"], "choices": choices, "answer_index": ans_idx, "answer": answer})
    return {
        "type": "trivia",
        "title": "Daily Trivia",
        "difficulty": difficulty,
        "questions": questions,
        "instructions": "Circle the best answer for each question. Answers on the solutions strip.",
    }


GENERATORS = {
    "crossword": generate_crossword,
    "sudoku": generate_sudoku,
    "wordsearch": generate_wordsearch,
    "cryptogram": generate_cryptogram,
    "trivia": generate_trivia,
}
