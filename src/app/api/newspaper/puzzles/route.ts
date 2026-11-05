import { NextResponse } from "next/server";
import { PUZZLE_CATALOG, PUZZLE_DIFFICULTIES, DEFAULT_PUZZLES } from "@/lib/puzzles";

export async function GET() {
  return NextResponse.json({
    puzzles: PUZZLE_CATALOG,
    difficulties: PUZZLE_DIFFICULTIES,
    defaults: DEFAULT_PUZZLES,
  });
}
