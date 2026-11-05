"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LLM_PROVIDERS, type LlmProviderId } from "@/lib/llm-providers";
import { loadProfile, saveProfile } from "@/lib/storage";
import { FALLBACK_TEMPLATES, type TemplateCard } from "@/lib/templates";
import type { ByokConfig, ColorMode, UserProfile } from "@/lib/types";

const FONTS = [
  { id: "georgia", label: "Georgia" },
  { id: "newsreader", label: "Newsreader" },
  { id: "libre", label: "Libre" },
  { id: "helvetica", label: "Helvetica" },
  { id: "system", label: "System" },
] as const;

const PAGE_OPTIONS = [1, 2, 3, 4, 5, 6, 8] as const;

export default function StudioPage() {
  const [templates, setTemplates] = useState<TemplateCard[]>(FALLBACK_TEMPLATES);
  const [template, setTemplate] = useState("classic");
  const [title, setTitle] = useState("The AI Times");
  const [email, setEmail] = useState("");
  const [newsPrompt, setNewsPrompt] = useState(
    "Useful morning coverage on AI, markets, and world affairs. Skip celebrity gossip.",
  );
  const [pages, setPages] = useState(4);
  const [font, setFont] = useState<(typeof FONTS)[number]["id"]>("georgia");
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [byokEnabled, setByokEnabled] = useState(false);
  const [provider, setProvider] = useState<LlmProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(LLM_PROVIDERS[0].baseUrl);
  const [model, setModel] = useState(LLM_PROVIDERS[0].defaultModel);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("/templates/classic/preview.html");
  const [previewKind, setPreviewKind] = useState<"sample" | "generated">("sample");
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [previewBroken, setPreviewBroken] = useState<Record<string, boolean>>({});

  const selected = useMemo(
    () => templates.find((t) => t.id === template) ?? templates[0],
    [templates, template],
  );

  useEffect(() => {
    const profile = loadProfile();
    let preferred = "classic";
    if (profile) {
      setTitle(
        profile.customTitle ||
          (profile.company?.companyName
            ? `The ${profile.company.companyName} Times`
            : profile.name
              ? `The ${profile.name} Times`
              : "The AI Times"),
      );
      setEmail(profile.email || "");
      setNewsPrompt(profile.newsPrompt || newsPrompt);
      if (typeof profile.pageCount === "number") setPages(profile.pageCount);
      setColorMode(profile.colorMode || "bw");
      if (profile.preferredFont) setFont(profile.preferredFont);
      if (profile.preferredTemplate) {
        preferred = profile.preferredTemplate;
        setTemplate(profile.preferredTemplate);
      }
      if (profile.byok) {
        setByokEnabled(profile.byok.enabled);
        setProvider(profile.byok.provider);
        setApiKey(profile.byok.apiKey || "");
        setBaseUrl(profile.byok.baseUrl || LLM_PROVIDERS[0].baseUrl);
        setModel(profile.byok.model || LLM_PROVIDERS[0].defaultModel);
      }
    }
    void fetch("/api/newspaper/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.templates) && data.templates.length) {
          setTemplates(data.templates);
          const match =
            data.templates.find((t: TemplateCard) => t.id === preferred) || data.templates[0];
          setTemplate(match.id);
          if (match.previewHtml) {
            setPreviewUrl(match.previewHtml);
            setPreviewKind("sample");
          }
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(id: string) {
    setTemplate(id);
    const card = templates.find((t) => t.id === id);
    if (card?.previewHtml) {
      setPreviewUrl(`${card.previewHtml}?t=${Date.now()}`);
      setPreviewKind("sample");
    }
  }

  function selectProvider(id: LlmProviderId) {
    const next = LLM_PROVIDERS.find((p) => p.id === id)!;
    setProvider(id);
    setBaseUrl(next.baseUrl);
    setModel(next.defaultModel);
  }

  function persistByok() {
    const profile = loadProfile();
    const byok: ByokConfig = {
      enabled: byokEnabled,
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
    };
    if (!profile) {
      const seed: UserProfile = {
        kind: "personal",
        name: "Reader",
        email: email || "reader@theaitimes.local",
        titleStyle: "the-times",
        interests: ["technology", "world", "business"],
        newsPrompt,
        byok,
        colorMode,
        preferredFont: font,
        preferredTemplate: template as UserProfile["preferredTemplate"],
        emailTime: "06:00",
        printEnabled: true,
        printTime: "06:05",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        pageCount: pages,
        breakingNews: true,
        createdAt: new Date().toISOString(),
      };
      saveProfile(seed);
      return byok;
    }
    saveProfile({
      ...profile,
      email: email || profile.email,
      newsPrompt,
      colorMode,
      preferredFont: font,
      preferredTemplate: template as UserProfile["preferredTemplate"],
      pageCount: pages,
      byok,
    });
    return byok;
  }

  async function generate(allTemplates = false) {
    setBusy(true);
    setStatus(
      allTemplates
        ? "Generating all 5 A4 templates with Python…"
        : `Generating ${pages}-page ${selected?.name || template} paper…`,
    );
    try {
      persistByok();
      const res = await fetch("/api/newspaper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          title,
          email: email || undefined,
          useLlm: byokEnabled && (Boolean(apiKey.trim()) || provider === "ollama"),
          pages,
          font,
          colorMode,
          newsPrompt: newsPrompt || undefined,
          allTemplates,
          byok: byokEnabled
            ? {
                enabled: true,
                provider,
                apiKey: apiKey.trim() || (provider === "ollama" ? "ollama" : ""),
                baseUrl: baseUrl.trim(),
                model: model.trim(),
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const urls = (data.results || [])
        .map((r: { publicUrl?: string }) => r.publicUrl)
        .filter(Boolean) as string[];
      const openUrl = data.openUrl || urls.at(-1) || "/editions/latest.html";
      setGeneratedUrls(urls.length ? urls : [openUrl]);
      setPreviewUrl(`${openUrl}?t=${Date.now()}`);
      setPreviewKind("generated");
      setStatus(
        `${allTemplates ? `Generated ${urls.length || 5} templates` : "Edition ready"} · ${pages} pages · ${font} · ${colorMode === "bw" ? "B&W" : "color"}${
          data.llmUsed ? " · LLM used" : " · offline desk editor"
        }. Live preview updated.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-24">
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/setup" className="btn-ghost">
              Setup
            </Link>
            <Link href="/editions/latest.html" className="btn-secondary !h-10 !px-4 !text-[13px]">
              Latest paper
            </Link>
          </div>
        }
      />

      {(busy || status) && (
        <div
          role="status"
          aria-live="polite"
          className={`sticky top-14 z-30 border-b px-5 py-3 text-[13px] font-medium sm:px-8 ${
            busy
              ? "border-[rgba(0,113,227,0.2)] bg-[rgba(0,113,227,0.08)] text-[hsl(var(--apple-blue))]"
              : status?.toLowerCase().includes("fail")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3">
            {busy ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[hsl(var(--apple-blue))] border-r-transparent" />
            ) : null}
            <span>{status || "Working…"}</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--apple-blue))]">
            Newspaper studio
          </p>
          <h1 className="font-display mt-3 text-[clamp(2.4rem,5vw,3.6rem)] font-semibold tracking-[-0.035em]">
            Pick a template. Set pages, font, color. Enter your API key. Generate.
          </h1>
        </div>

        {/* Controls + BYOK above the fold */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="surface rounded-[24px] p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
              Print controls · {selected?.name}
            </div>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">Masthead</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                  News prompt
                </span>
                <textarea
                  value={newsPrompt}
                  onChange={(e) => setNewsPrompt(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                  Pages (A4)
                </span>
                <div className="flex flex-wrap gap-2">
                  {PAGE_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPages(n)}
                      className={`h-10 min-w-11 rounded-xl border px-3 text-[14px] font-semibold ${
                        pages === n
                          ? "border-transparent bg-[hsl(var(--ink))] text-white"
                          : "border-black/[0.08] bg-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">Font</span>
                <div className="flex flex-wrap gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFont(f.id)}
                      className={`h-10 rounded-xl border px-3 text-[13px] font-semibold ${
                        font === f.id
                          ? "border-transparent bg-[hsl(var(--ink))] text-white"
                          : "border-black/[0.08] bg-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                  Print color
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(["bw", "color"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setColorMode(mode)}
                      className={`h-11 rounded-xl border text-[14px] font-medium ${
                        colorMode === mode
                          ? "border-transparent bg-[hsl(var(--ink))] text-white"
                          : "border-black/[0.08] bg-white"
                      }`}
                    >
                      {mode === "bw" ? "Black & white" : "Color"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                  Email (optional)
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void generate(false)}
                >
                  {busy ? "Generating…" : `Generate ${selected?.id || "paper"}`}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void generate(true)}
                >
                  Generate all templates
                </button>
              </div>
              {generatedUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {generatedUrls.map((url) => (
                    <button
                      key={url}
                      type="button"
                      className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12px] font-medium"
                      onClick={() => {
                        setPreviewUrl(`${url}?t=${Date.now()}`);
                        setPreviewKind("generated");
                      }}
                    >
                      Open {url.split("/").pop()}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div id="byok" className="surface rounded-[24px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                  Bring your own key
                </div>
                <h2 className="font-display mt-1 text-xl font-semibold">API key for the Python agent</h2>
              </div>
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={byokEnabled}
                  onChange={(e) => setByokEnabled(e.target.checked)}
                  className="h-5 w-5 accent-[hsl(var(--apple-blue))]"
                />
                Enable
              </label>
            </div>
            <p className="mt-2 text-[13px] text-[hsl(var(--muted-foreground))]">
              Paste OpenAI / Claude / Gemini / Groq / Ollama. Offline desk editor runs if this is off.
            </p>
            <div className={`mt-4 space-y-3 ${byokEnabled ? "" : "opacity-45"}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LLM_PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!byokEnabled}
                    onClick={() => selectProvider(item.id)}
                    className={`rounded-xl border px-2 py-2 text-[12px] font-semibold disabled:cursor-not-allowed ${
                      provider === item.id
                        ? "border-[rgba(0,113,227,0.5)] bg-[rgba(0,113,227,0.06)]"
                        : "border-black/[0.08] bg-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                type="password"
                disabled={!byokEnabled}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API key"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))] disabled:opacity-60"
              />
              <input
                disabled={!byokEnabled}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Base URL"
                className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))] disabled:opacity-60"
              />
              <input
                disabled={!byokEnabled}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model"
                className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))] disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Templates</h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Click a card to preview the sample look. Generate applies your pages / font / color.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {templates.map((item) => {
                const active = template === item.id;
                const broken = previewBroken[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTemplate(item.id)}
                    className={`overflow-hidden rounded-[18px] border bg-white text-left transition ${
                      active
                        ? "border-[rgba(0,113,227,0.55)] shadow-[0_0_0_3px_rgba(0,113,227,0.12)]"
                        : "border-black/[0.08]"
                    }`}
                  >
                    <div className="relative aspect-[3/4] bg-[#eceae4]">
                      {!broken && item.previewImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${item.previewImage}?v=4`}
                          alt={item.name}
                          className="h-full w-full object-cover object-top"
                          onError={() => setPreviewBroken((p) => ({ ...p, [item.id]: true }))}
                        />
                      ) : (
                        <div className="flex h-full items-end p-3 font-display text-lg font-semibold">
                          {item.name}
                        </div>
                      )}
                      {active ? (
                        <span className="absolute left-2 top-2 rounded-full bg-[hsl(var(--apple-blue))] px-2.5 py-1 text-[10px] font-semibold text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <div className="border-t border-black/[0.06] p-2.5">
                      <div className="font-display text-[0.98rem] font-semibold">{item.name}</div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--muted-foreground))]">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-black/[0.08] bg-white shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)] xl:sticky xl:top-24 xl:self-start">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                {previewKind === "generated"
                  ? `Generated · ${pages} pages · ${font} · ${colorMode}`
                  : `Sample look · ${selected?.name} (generate to apply ${pages} pages / ${font})`}
              </div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold text-[hsl(var(--apple-blue))]"
              >
                Open full size →
              </a>
            </div>
            <iframe
              key={previewUrl}
              title="Newspaper preview"
              src={previewUrl}
              className="h-[min(78vh,900px)] w-full bg-[#f4f1ea]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
