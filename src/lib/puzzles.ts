export type PuzzleTypeId =
  | "crossword"
  | "sudoku"
  | "wordsearch"
  | "cryptogram"
  | "trivia";

export type PuzzleDifficulty = "easy" | "medium" | "hard";

export const PUZZLE_CATALOG: {
  id: PuzzleTypeId;
  name: string;
  description: string;
}[] = [
  {
    id: "crossword",
    name: "Mini Crossword",
    description: "Classic across clues — a newspaper staple.",
  },
  {
    id: "sudoku",
    name: "Sudoku",
    description: "Fill 1–9 so every row, column, and box is unique.",
  },
  {
    id: "wordsearch",
    name: "Word Search",
    description: "Find hidden words in the letter grid.",
  },
  {
    id: "cryptogram",
    name: "Cryptogram",
    description: "Decode a quotation letter by letter.",
  },
  {
    id: "trivia",
    name: "Daily Trivia",
    description: "Five fresh questions from world, science, and culture.",
  },
];

export const PUZZLE_DIFFICULTIES: { id: PuzzleDifficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

export const DEFAULT_PUZZLES: PuzzleTypeId[] = ["crossword", "sudoku", "wordsearch"];
