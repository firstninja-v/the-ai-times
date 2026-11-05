import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 70% -10%, hsl(0 72% 38% / 0.08), transparent 60%), linear-gradient(180deg, hsl(40 18% 97%) 0%, hsl(40 10% 93%) 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-16 pt-8 sm:px-10">
        <header className="no-print flex items-center justify-between animate-fade">
          <div className="font-display text-xl font-semibold tracking-tight">Quietpress</div>
          <Link
            href="/setup"
            className="font-ui text-sm text-muted-foreground transition hover:text-ink"
          >
            Start free
          </Link>
        </header>

        <section className="relative mt-16 flex flex-1 flex-col justify-center pb-24 sm:mt-0">
          <div className="max-w-2xl">
            <p className="animate-rise font-ui text-[11px] uppercase tracking-[0.28em] text-masthead">
              Personal morning newspaper
            </p>
            <h1 className="animate-rise font-display mt-5 text-5xl font-semibold leading-[0.95] tracking-tight text-ink sm:text-7xl lg:text-8xl">
              Quietpress
            </h1>
            <p
              className="animate-rise mt-6 max-w-md text-lg leading-relaxed text-ink/70"
              style={{ animationDelay: "120ms" }}
            >
              Only the news you asked for. Delivered by email every morning, printed at your desk,
              interrupted only for breaking stories that matter.
            </p>
            <div className="animate-rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
              <Button asChild className="h-12 rounded-sm px-7 text-sm">
                <Link href="/setup">Compose your paper</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-sm border-ink/20 bg-transparent px-7 text-sm">
                <Link href="/edition">View sample edition</Link>
              </Button>
            </div>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 bottom-8 hidden w-[46%] max-w-md rotate-[-4deg] animate-fade md:block"
            style={{ animationDelay: "280ms" }}
          >
            <div className="paper-sheet border border-ink/10 px-6 py-7">
              <div className="text-center">
                <div className="font-ui text-[9px] uppercase tracking-[0.28em] text-masthead">
                  Morning fold
                </div>
                <div className="font-display mt-2 text-3xl font-semibold">The Reader Times</div>
                <div className="ink-rule-thick mx-auto mt-3 w-full origin-left animate-draw" />
                <div className="mt-4 space-y-3 text-left">
                  <div className="h-3 w-4/5 bg-ink/80" />
                  <div className="h-2 w-full bg-ink/25" />
                  <div className="h-2 w-[92%] bg-ink/25" />
                  <div className="h-2 w-[88%] bg-ink/25" />
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-ink/20" />
                      <div className="h-2 w-[90%] bg-ink/20" />
                      <div className="h-2 w-[80%] bg-ink/20" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-ink/20" />
                      <div className="h-2 w-[85%] bg-ink/20" />
                      <div className="h-2 w-[70%] bg-ink/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="no-print border-t border-rule pt-12">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                title: "Interest-matched",
                body: "You choose topics. Quietpress ranks signal and drops slop before it reaches the page.",
              },
              {
                title: "Email + print",
                body: "Morning email on your clock. Optional local print agent sends the edition to your printer.",
              },
              {
                title: "Breaking only when needed",
                body: "Stay quiet through the day—unless something urgent matches your interests.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h2 className="font-display text-2xl font-semibold text-ink">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
