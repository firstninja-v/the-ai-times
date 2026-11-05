"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const TEMPLATES = [
  { id: "classic", name: "Classic Broadsheet", blurb: "Traditional ink masthead, multi-column reading." },
  { id: "modern", name: "Modern Daily", blurb: "Airy spacing, large lead image, soft rules." },
  { id: "compact", name: "Compact Brief", blurb: "Fast morning scan with thumbnails." },
  { id: "broadsheet", name: "Sunday Broadsheet", blurb: "Wide feature photography layout." },
  { id: "magazine", name: "Magazine Fold", blurb: "Bold cover story and feature grid." },
] as const;

export default function StudioPage() {
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("classic");
  const [title, setTitle] = useState("The AI Times");
  const [email, setEmail] = useState("");
  const [useLlm, setUseLlm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  async function generate() {
    setBusy(true);
    setStatus("Generating designed newspaper…");
    try {
      const res = await fetch("/api/newspaper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          title,
          email: email || undefined,
          useLlm,
          pages: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setLog(data.stdout || "");
      setStatus(
        email
          ? "Edition generated. Email sent or mocked if SMTP is unset — check `.ai-times/editions/`."
          : "Edition generated in `.ai-times/editions/`. Open the newest HTML file.",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-20">
      <SiteHeader
        right={
          <Link href="/edition" className="btn-ghost">
            Live edition
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-5 pt-12 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--apple-blue))]">
          Newspaper studio
        </p>
        <h1 className="font-display mt-3 text-[clamp(2.4rem,6vw,3.6rem)] font-semibold tracking-[-0.03em]">
          Ready-made templates
        </h1>
        <p className="mt-3 max-w-xl text-[16px] text-[hsl(var(--muted-foreground))]">
          Python generates readable multi-page papers with images. Drop in any small-model API key
          (OpenAI-compatible) and SMTP config when you want AI editing + email delivery.
        </p>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTemplate(item.id)}
              className={`choice text-left ${template === item.id ? "choice-active" : ""}`}
            >
              <div className="font-display text-lg font-semibold">{item.name}</div>
              <div className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">{item.blurb}</div>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Masthead</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Email to (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
            />
          </label>
        </div>

        <label className="choice mt-4 flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div className="text-[15px] font-medium">Use small model API</div>
            <div className="text-[13px] text-[hsl(var(--muted-foreground))]">
              Requires `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` in `.env.local`
            </div>
          </div>
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
            className="h-5 w-5 accent-[hsl(var(--apple-blue))]"
          />
        </label>

        <button type="button" className="btn-primary mt-8" disabled={busy} onClick={generate}>
          {busy ? "Generating…" : `Generate ${template} paper`}
        </button>

        {status ? <p className="mt-5 text-[14px] text-[hsl(var(--apple-blue))]">{status}</p> : null}
        {log ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-2xl bg-black/[0.04] p-4 text-[12px] leading-relaxed">
            {log}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
