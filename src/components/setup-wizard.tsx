"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { INTEREST_CATALOG } from "@/lib/interests";
import { LLM_PROVIDERS, type LlmProviderId } from "@/lib/llm-providers";
import { TITLE_OPTIONS } from "@/lib/paper-titles";
import { saveProfile } from "@/lib/storage";
import { PuzzlePicker } from "@/components/puzzle-picker";
import { DEFAULT_PUZZLES, type PuzzleDifficulty, type PuzzleTypeId } from "@/lib/puzzles";
import type { ColorMode, PaperKind, PaperTitleStyle, UserProfile } from "@/lib/types";
import { TemplateGallery } from "@/components/template-gallery";

const STEPS = ["Identity", "Interests", "Delivery", "Games", "Templates"] as const;

export function SetupWizard({ initialKind = "personal" }: { initialKind?: PaperKind }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<PaperKind>(initialKind);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [titleStyle, setTitleStyle] = useState<PaperTitleStyle>("the-times");
  const [customTitle, setCustomTitle] = useState("");
  const [interests, setInterests] = useState<string[]>(["technology", "world", "business"]);
  const [newsPrompt, setNewsPrompt] = useState(
    "I want useful morning coverage on AI, markets, and major world events — skip celebrity gossip and shopping content.",
  );
  const [byokEnabled, setByokEnabled] = useState(false);
  const [provider, setProvider] = useState<LlmProviderId>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(LLM_PROVIDERS[0].baseUrl);
  const [model, setModel] = useState(LLM_PROVIDERS[0].defaultModel);
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [preferredFont, setPreferredFont] = useState<
    "georgia" | "newsreader" | "libre" | "helvetica" | "system"
  >("georgia");
  const [preferredTemplate, setPreferredTemplate] = useState<
    "classic" | "modern" | "compact" | "broadsheet" | "magazine"
  >("classic");
  const [puzzles, setPuzzles] = useState<PuzzleTypeId[]>([...DEFAULT_PUZZLES]);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<PuzzleDifficulty>("medium");
  const [emailTime, setEmailTime] = useState("06:00");
  const [printEnabled, setPrintEnabled] = useState(true);
  const [printTime, setPrintTime] = useState("06:05");
  const [breakingNews, setBreakingNews] = useState(true);
  const [pageCount, setPageCount] = useState<"auto" | number>(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const displayName = kind === "company" ? companyName || name : name;
  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === provider)!;

  const previewTitle = useMemo(() => {
    if (kind === "company" && (customTitle.trim() || companyName.trim())) {
      return customTitle.trim() || `The ${companyName.trim()} Times`;
    }
    const option = TITLE_OPTIONS.find((o) => o.id === titleStyle)!;
    if (titleStyle === "custom") return customTitle.trim() || "Your custom masthead";
    return option.example(displayName.trim() || "Reader");
  }, [titleStyle, customTitle, displayName, kind, companyName]);

  function selectProvider(id: LlmProviderId) {
    const next = LLM_PROVIDERS.find((p) => p.id === id)!;
    setProvider(id);
    setBaseUrl(next.baseUrl);
    setModel(next.defaultModel);
  }

  function toggleInterest(id: string) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function validateThrough(stepIndex: number): boolean {
    setError(null);
    if (stepIndex >= 0) {
      if (!name.trim() || !email.trim()) {
        setError("Name and email are required.");
        setStep(0);
        return false;
      }
      if (!email.includes("@")) {
        setError("Enter a valid email address.");
        setStep(0);
        return false;
      }
      if (kind === "company" && !companyName.trim()) {
        setError("Company name is required for a company paper.");
        setStep(0);
        return false;
      }
    }
    if (stepIndex >= 1) {
      if (interests.length === 0 && !newsPrompt.trim()) {
        setError("Pick interests or write a news prompt.");
        setStep(1);
        return false;
      }
      if (byokEnabled && !apiKey.trim() && provider !== "ollama") {
        setError("Paste your API key or turn off Bring Your Own Key.");
        setStep(1);
        return false;
      }
    }
    return true;
  }

  function buildProfile(): UserProfile {
    return {
      kind,
      name: name.trim(),
      email: email.trim(),
      titleStyle,
      customTitle: customTitle.trim() || undefined,
      interests,
      newsPrompt: newsPrompt.trim() || undefined,
      byok: {
        enabled: byokEnabled,
        provider,
        apiKey: apiKey.trim() || (provider === "ollama" ? "ollama" : ""),
        baseUrl: baseUrl.trim() || selectedProvider.baseUrl,
        model: model.trim() || selectedProvider.defaultModel,
      },
      colorMode,
      preferredFont,
      preferredTemplate,
      puzzles,
      puzzleDifficulty,
      emailTime,
      printEnabled,
      printTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      pageCount,
      breakingNews,
      createdAt: new Date().toISOString(),
      ...(kind === "company"
        ? {
            company: {
              companyName: companyName.trim(),
              industry: industry.trim() || undefined,
              keywords: keywordsText
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
              competitors: competitorsText
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
            },
          }
        : {}),
    };
  }

  async function finish() {
    if (!validateThrough(4)) return;
    setBusy(true);
    setStatus("Saving profile and generating your selected template…");
    const profile = buildProfile();
    saveProfile(profile);

    try {
      const pages = typeof pageCount === "number" ? pageCount : 4;
      const res = await fetch("/api/newspaper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: preferredTemplate,
          title: previewTitle,
          email: profile.email,
          useLlm: Boolean(profile.byok?.enabled && profile.byok.apiKey),
          pages,
          font: preferredFont,
          colorMode,
          newsPrompt: newsPrompt || undefined,
          company: profile.company?.companyName,
          puzzles,
          puzzleDifficulty,
          byok: profile.byok?.enabled ? profile.byok : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setStatus("Paper ready — opening your edition.");
      const openUrl = data.openUrl || "/editions/latest.html";
      window.location.assign(openUrl);
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof Error
          ? `${err.message} Profile saved — open Templates studio to retry.`
          : "Generation failed. Profile saved.",
      );
      router.push("/studio");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    if (!validateThrough(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-10 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (index > step && !validateThrough(step)) return;
              setStep(index);
            }}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
              index === step
                ? "bg-[hsl(var(--ink))] text-white"
                : "bg-black/[0.04] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--ink))]"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="mx-auto max-w-[640px] space-y-8">
          <div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em]">
              {kind === "company" ? "Company paper" : "Name your paper"}
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-[hsl(var(--muted-foreground))]">
              Masthead first. Interests, delivery, then pick a visual template.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Paper type">
            <button
              type="button"
              onClick={() => setKind("personal")}
              className={`h-12 rounded-2xl border text-[14px] font-semibold ${
                kind === "personal"
                  ? "border-transparent bg-[hsl(var(--ink))] text-white"
                  : "border-black/[0.08] bg-white"
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setKind("company")}
              className={`h-12 rounded-2xl border text-[14px] font-semibold ${
                kind === "company"
                  ? "border-transparent bg-[hsl(var(--ink))] text-white"
                  : "border-black/[0.08] bg-white"
              }`}
            >
              Company
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                {kind === "company" ? "Editor name" : "Your name"}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
            </label>
          </div>
          {kind === "company" ? (
            <div className="space-y-4">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
              <input
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="Keywords, comma-separated"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
              <input
                value={competitorsText}
                onChange={(e) => setCompetitorsText(e.target.value)}
                placeholder="Competitors, comma-separated"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {TITLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTitleStyle(option.id)}
                  className={`choice ${titleStyle === option.id ? "choice-active" : ""}`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                    {option.label}
                  </div>
                  <div className="font-display mt-1 text-lg font-semibold">
                    {option.id === "custom" ? "Write your own" : option.example(name.trim() || "Reader")}
                  </div>
                </button>
              ))}
            </div>
          )}
          {(titleStyle === "custom" || kind === "company") && (
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Custom masthead (optional)"
              className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
            />
          )}
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            Preview: <span className="font-display font-semibold text-[hsl(var(--ink))]">{previewTitle}</span>
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-8">
            <div>
              <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em]">
                What matters
              </h1>
              <p className="mt-3 max-w-xl text-[16px] text-[hsl(var(--muted-foreground))]">
                Describe the newspaper you want in plain English, then optionally narrow with topics.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                News prompt
              </span>
              <textarea
                value={newsPrompt}
                onChange={(e) => setNewsPrompt(e.target.value)}
                rows={5}
                placeholder="Example: Cover semiconductor supply chains, Fed policy, and India tech startups. Ignore sports and celebrity news."
                className="w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[15px] leading-relaxed outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {INTEREST_CATALOG.map((interest) => {
                const checked = interests.includes(interest.id);
                return (
                  <label
                    key={interest.id}
                    className={`choice flex cursor-pointer items-center gap-3 ${checked ? "choice-active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleInterest(interest.id)}
                      className="h-4 w-4 accent-[hsl(var(--apple-blue))]"
                    />
                    <span className="text-[15px] font-medium">{interest.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Pages</span>
                <select
                  value={pageCount === "auto" ? "auto" : String(pageCount)}
                  onChange={(e) =>
                    setPageCount(e.target.value === "auto" ? "auto" : Number(e.target.value))
                  }
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none"
                >
                  <option value="auto">Auto</option>
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} pages
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Font</span>
                <select
                  value={preferredFont}
                  onChange={(e) =>
                    setPreferredFont(
                      e.target.value as "georgia" | "newsreader" | "libre" | "helvetica" | "system",
                    )
                  }
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none"
                >
                  <option value="georgia">Georgia</option>
                  <option value="newsreader">Newsreader</option>
                  <option value="libre">Libre Baskerville</option>
                  <option value="helvetica">Helvetica</option>
                  <option value="system">System UI</option>
                </select>
              </label>
              <div className="space-y-2">
                <div className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Print color</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["bw", "color"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setColorMode(mode)}
                      className={`h-12 rounded-2xl border text-[14px] font-medium ${
                        colorMode === mode
                          ? "border-transparent bg-[hsl(var(--ink))] text-white"
                          : "border-black/[0.08] bg-white"
                      }`}
                    >
                      {mode === "bw" ? "B&W" : "Color"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="surface rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
                    Bring your own key
                  </div>
                  <h2 className="font-display mt-1 text-2xl font-semibold tracking-[-0.02em]">
                    Model desk
                  </h2>
                </div>
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input
                    type="checkbox"
                    checked={byokEnabled}
                    onChange={(e) => setByokEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[hsl(var(--apple-blue))]"
                  />
                  ON
                </label>
              </div>
              <p className="mt-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                Use OpenAI, Claude, Gemini, Groq, Ollama, or any OpenAI-compatible small model.
                Keys stay in your browser profile.
              </p>

              <div className={`mt-4 space-y-3 ${byokEnabled ? "" : "pointer-events-none opacity-45"}`}>
                <div className="grid grid-cols-2 gap-2">
                  {LLM_PROVIDERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectProvider(item.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-[12px] font-semibold ${
                        provider === item.id
                          ? "border-[rgba(0,113,227,0.5)] bg-[rgba(0,113,227,0.06)]"
                          : "border-black/[0.08] bg-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">API key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-... / AIza... / ollama"
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">Base URL</span>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">Model</span>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-[hsl(var(--apple-blue))]"
                  />
                </label>
                <p className="text-[12px] text-[hsl(var(--muted-foreground))]">{selectedProvider.hint}</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {step === 2 && (
        <div className="mx-auto max-w-[640px] space-y-8">
          <div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em]">
              Morning ritual
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-[hsl(var(--muted-foreground))]">
              Default is 6:00 email and 6:05 print — alarm, paper, done.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Email time</span>
              <input
                type="time"
                value={emailTime}
                onChange={(e) => setEmailTime(e.target.value)}
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Print time</span>
              <input
                type="time"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
                disabled={!printEnabled}
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 outline-none disabled:opacity-40"
              />
            </label>
          </div>
          <label className="choice flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-medium">Hands-free printer loop</div>
              <div className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                Auto-prints at your time via `npm run agent:print`
              </div>
            </div>
            <input
              type="checkbox"
              checked={printEnabled}
              onChange={(e) => setPrintEnabled(e.target.checked)}
              className="h-5 w-5 accent-[hsl(var(--apple-blue))]"
            />
          </label>
          <label className="choice flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-medium">Breaking desk</div>
              <div className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                Non-stop Scrapling + wire alerts
              </div>
            </div>
            <input
              type="checkbox"
              checked={breakingNews}
              onChange={(e) => setBreakingNews(e.target.checked)}
              className="h-5 w-5 accent-[hsl(var(--apple-blue))]"
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="mx-auto max-w-3xl">
          <div className="surface rounded-[24px] p-6">
            <PuzzlePicker
              selected={puzzles}
              difficulty={puzzleDifficulty}
              onChange={setPuzzles}
              onDifficulty={setPuzzleDifficulty}
            />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <TemplateGallery
            selectedId={preferredTemplate}
            onSelect={(id) =>
              setPreferredTemplate(
                id as "classic" | "modern" | "compact" | "broadsheet" | "magazine",
              )
            }
            title="Pick how your paper looks"
            subtitle={`Click a template to preview it live. We’ll generate “${previewTitle}” with your games desk (${puzzles.length} puzzles · ${puzzleDifficulty}).`}
            showLivePreview
          />
        </div>
      )}

      {error ? <p className="mt-6 text-[14px] font-medium text-[hsl(var(--destructive))]">{error}</p> : null}
      {status ? <p className="mt-4 text-[14px] font-medium text-[hsl(var(--apple-blue))]">{status}</p> : null}

      <div className="mt-12 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="btn-ghost disabled:opacity-30"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} className="btn-primary" disabled={busy}>
            Continue
          </button>
        ) : (
          <button type="button" onClick={() => void finish()} className="btn-primary" disabled={busy}>
            {busy ? "Generating…" : `Generate ${preferredTemplate} paper`}
          </button>
        )}
      </div>
    </div>
  );
}
