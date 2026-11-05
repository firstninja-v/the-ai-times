"use client";

import { CONTENT_VOLUMES, type ContentVolume } from "@/lib/content-volume";

type Props = {
  value: ContentVolume;
  onChange: (v: ContentVolume) => void;
};

export function ContentVolumePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
        How much to read
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CONTENT_VOLUMES.map((item) => {
          const on = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                on
                  ? "border-transparent bg-[hsl(var(--ink))] text-white"
                  : "border-black/[0.08] bg-white"
              }`}
            >
              <div className="text-[14px] font-semibold">{item.label}</div>
              <p
                className={`mt-1 text-[11px] leading-snug ${
                  on ? "text-white/75" : "text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
