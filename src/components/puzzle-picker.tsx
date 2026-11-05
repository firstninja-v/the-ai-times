"use client";

import {
  DEFAULT_PUZZLES,
  PUZZLE_CATALOG,
  PUZZLE_DIFFICULTIES,
  type PuzzleDifficulty,
  type PuzzleTypeId,
} from "@/lib/puzzles";

type Props = {
  selected: PuzzleTypeId[];
  difficulty: PuzzleDifficulty;
  onChange: (next: PuzzleTypeId[]) => void;
  onDifficulty: (d: PuzzleDifficulty) => void;
};

export function PuzzlePicker({ selected, difficulty, onChange, onDifficulty }: Props) {
  function toggle(id: PuzzleTypeId) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
          Games desk
        </div>
        <h2 className="font-display mt-1 text-xl font-semibold tracking-[-0.02em]">
          Pick today’s puzzles
        </h2>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Five famous paper games. Fresh board every day — nothing repeats.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PUZZLE_CATALOG.map((item) => {
          const on = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                on
                  ? "border-[rgba(0,113,227,0.55)] bg-[rgba(0,113,227,0.06)] shadow-[0_0_0_3px_rgba(0,113,227,0.1)]"
                  : "border-black/[0.08] bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-[1.05rem] font-semibold">{item.name}</div>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    on ? "text-[hsl(var(--apple-blue))]" : "text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {on ? "On" : "Off"}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[hsl(var(--muted-foreground))]">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
          Difficulty
        </span>
        <div className="grid grid-cols-3 gap-2">
          {PUZZLE_DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDifficulty(d.id)}
              className={`h-11 rounded-xl border text-[14px] font-semibold ${
                difficulty === d.id
                  ? "border-transparent bg-[hsl(var(--ink))] text-white"
                  : "border-black/[0.08] bg-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {selected.length === 0 ? (
        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
          No puzzles selected — paper will be news-only.{" "}
          <button
            type="button"
            className="font-semibold text-[hsl(var(--apple-blue))]"
            onClick={() => onChange([...DEFAULT_PUZZLES])}
          >
            Restore defaults
          </button>
        </p>
      ) : (
        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
          {selected.length} game{selected.length === 1 ? "" : "s"} · {difficulty} · unique for today
        </p>
      )}
    </div>
  );
}
