import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/studio" className="btn-ghost hidden sm:inline-flex">
              Templates
            </Link>
            <Link href="/setup" className="btn-secondary !h-10 !px-4 !text-[13px]">
              Start free
            </Link>
          </div>
        }
      />

      <section className="relative min-h-[calc(100vh-3.5rem)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(251,251,253,0.92) 0%, rgba(251,251,253,0.78) 42%, rgba(251,251,253,0.35) 100%), url('/hero/morning-print-ritual.jpg')",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 420px at 20% 30%, rgba(0,113,227,0.10), transparent 60%)",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-[1120px] flex-col justify-center px-6 py-16 sm:px-10">
          <div className="max-w-xl">
            <p className="reveal text-[12px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--apple-blue))]">
              Alarm 6:00 · Printer 6:05
            </p>
            <h1 className="reveal reveal-delay-1 font-display mt-5 text-[clamp(3.4rem,9vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-[hsl(var(--ink))]">
              The AI Times
            </h1>
            <p className="reveal reveal-delay-2 mt-6 max-w-md text-[18px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Tell it what news you want. Bring your own OpenAI, Claude, Gemini, or Groq key.
              Wake up to email — and a paper already printing.
            </p>
            <div className="reveal reveal-delay-3 mt-10 flex flex-wrap gap-3">
              <Link href="/setup" className="btn-primary min-w-[170px]">
                Compose your paper
              </Link>
              <Link href="/company" className="btn-secondary min-w-[170px]">
                Company paper
              </Link>
              <Link href="/studio" className="btn-secondary min-w-[170px]">
                Design studio
              </Link>
            </div>
            <div className="reveal reveal-delay-3 mt-8 flex flex-wrap gap-2 text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
              {["News prompt", "BYOK models", "Scrapling desk", "Auto print"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-black/[0.08] bg-white/70 px-3 py-1 backdrop-blur"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.05] bg-[#fbfbfd]">
        <div className="mx-auto max-w-[1120px] px-6 py-20 sm:px-10">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--apple-blue))]">
              How it works
            </p>
            <h2 className="font-display mt-3 text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em]">
              Prompt. Rank. Design. Deliver.
            </h2>
          </div>
          <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Describe your desk",
                body: "Write a plain-English prompt for the stories you want — and the noise to ignore.",
              },
              {
                step: "02",
                title: "Bring your own key",
                body: "Optional BYOK for OpenAI, Claude, Gemini, Groq, Ollama, or any OpenAI-compatible model.",
              },
              {
                step: "03",
                title: "Always-on collection",
                body: "Premium wires + Scrapling keep ranking signal all day for morning and breaking alerts.",
              },
              {
                step: "04",
                title: "6am print ritual",
                body: "Email lands first. The print daemon sends the edition to your printer without another click.",
              },
            ].map((item) => (
              <div key={item.step}>
                <div className="text-[12px] font-semibold tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                  {item.step}
                </div>
                <h3 className="font-display mt-3 text-[1.55rem] font-semibold tracking-[-0.02em]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
