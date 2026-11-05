import type { ReactNode } from "react";
import Link from "next/link";

export function SiteHeader({
  right,
}: {
  right?: ReactNode;
}) {
  return (
    <header className="no-print glass-bar sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))]">
          The AI Times
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
