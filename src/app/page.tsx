import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <SiteHeader
        right={
          <Link href="/setup" className="btn-ghost">
            Start free
          </Link>
        }
      />

      <section className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1120px] flex-col justify-center px-6 pb-28 pt-8 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,113,227,0.12),transparent_62%)] blur-2xl"
        />

        <div className="relative z-10 mx-auto max-w-[720px] text-center">
          <p className="reveal text-[12px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--apple-blue))]">
            Personal morning newspaper
          </p>
          <h1 className="reveal reveal-delay-1 font-display mt-6 text-[clamp(3.8rem,11vw,7.2rem)] font-semibold leading-[0.9] tracking-[-0.045em] text-[hsl(var(--ink))]">
            The AI Times
          </h1>
          <p className="reveal reveal-delay-2 mx-auto mt-7 max-w-[34rem] text-[18px] leading-[1.55] text-[hsl(var(--muted-foreground))]">
            Only the news you asked for. Delivered by email every morning, printed at your desk,
            interrupted only for breaking stories that matter.
          </p>
          <div className="reveal reveal-delay-3 mt-11 flex flex-wrap items-center justify-center gap-3">
            <Link href="/setup" className="btn-primary min-w-[180px]">
              Compose your paper
            </Link>
            <Link href="/edition" className="btn-secondary min-w-[180px]">
              View today&apos;s edition
            </Link>
          </div>
        </div>

        <div
          aria-hidden
          className="reveal reveal-delay-3 relative z-10 mx-auto mt-16 w-full max-w-[560px]"
        >
          <div className="paper-sheet mx-auto rotate-[-1.5deg] rounded-[2px] px-8 py-9 sm:px-12 sm:py-11">
            <div className="text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--masthead))]">
                Morning fold
              </div>
              <div className="font-display mt-3 text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-[-0.03em]">
                The Reader Times
              </div>
              <div className="ink-rule-thick mx-auto mt-5 w-full" />
              <div className="mt-5 flex justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                <span>Thursday edition</span>
                <span>No ads</span>
                <span>Page 1</span>
              </div>
              <div className="ink-rule mt-3 w-full" />
              <div className="mt-7 space-y-3 text-left">
                <div className="h-3.5 w-[72%] rounded-full bg-[hsl(var(--ink))]/90" />
                <div className="h-2 w-full rounded-full bg-[hsl(var(--ink))]/12" />
                <div className="h-2 w-[96%] rounded-full bg-[hsl(var(--ink))]/12" />
                <div className="h-2 w-[91%] rounded-full bg-[hsl(var(--ink))]/12" />
                <div className="mt-8 grid grid-cols-2 gap-8">
                  <div className="space-y-2.5 border-t border-black/10 pt-4">
                    <div className="h-2.5 w-[70%] rounded-full bg-[hsl(var(--ink))]/70" />
                    <div className="h-2 w-full rounded-full bg-[hsl(var(--ink))]/10" />
                    <div className="h-2 w-[88%] rounded-full bg-[hsl(var(--ink))]/10" />
                  </div>
                  <div className="space-y-2.5 border-t border-black/10 pt-4">
                    <div className="h-2.5 w-[64%] rounded-full bg-[hsl(var(--ink))]/70" />
                    <div className="h-2 w-full rounded-full bg-[hsl(var(--ink))]/10" />
                    <div className="h-2 w-[80%] rounded-full bg-[hsl(var(--ink))]/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.05] bg-[#fbfbfd]">
        <div className="mx-auto grid max-w-[1120px] gap-14 px-6 py-24 sm:px-10 md:grid-cols-3">
          {[
            {
              title: "Interest-matched",
              body: "You choose topics. The AI Times ranks signal and drops slop before it reaches the page.",
            },
            {
              title: "Email + print",
              body: "Morning email on your clock. Optional local print agent sends the edition to your printer.",
            },
            {
              title: "Breaking, sparingly",
              body: "Stay quiet through the day—unless something urgent matches your interests.",
            },
          ].map((item) => (
            <div key={item.title} className="max-w-sm">
              <h2 className="font-display text-[1.85rem] font-semibold tracking-[-0.025em] text-[hsl(var(--ink))]">
                {item.title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
