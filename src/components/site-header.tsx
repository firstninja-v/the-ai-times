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
        <div className="flex items-center gap-5">
          <Link href="/" className="font-display text-[19px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))]">
            The AI Times
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/agent" className="btn-ghost !h-9 !px-3 !text-[12px]">
              Daily agent
            </Link>
            <Link href="/studio" className="btn-ghost !h-9 !px-3 !text-[12px]">
              Studio
            </Link>
            <Link href="/edition" className="btn-ghost !h-9 !px-3 !text-[12px]">
              Edition
            </Link>
            <Link href="/settings" className="btn-ghost !h-9 !px-3 !text-[12px]">
              Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
