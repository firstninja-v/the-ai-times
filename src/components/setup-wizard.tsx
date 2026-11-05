"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { INTEREST_CATALOG } from "@/lib/interests";
import { TITLE_OPTIONS } from "@/lib/paper-titles";
import { saveProfile } from "@/lib/storage";
import type { ColorMode, PaperKind, PaperTitleStyle, UserProfile } from "@/lib/types";

const STEPS = ["Identity", "Interests", "Delivery"] as const;

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
  const [colorMode, setColorMode] = useState<ColorMode>("bw");
  const [emailTime, setEmailTime] = useState("07:00");
  const [printEnabled, setPrintEnabled] = useState(true);
  const [printTime, setPrintTime] = useState("07:05");
  const [breakingNews, setBreakingNews] = useState(true);
  const [pageCount, setPageCount] = useState<"auto" | number>("auto");
  const [error, setError] = useState<string | null>(null);

  const displayName = kind === "company" ? companyName || name : name;

  const previewTitle = useMemo(() => {
    if (kind === "company" && (customTitle.trim() || companyName.trim())) {
      return customTitle.trim() || `The ${companyName.trim()} Times`;
    }
    const option = TITLE_OPTIONS.find((o) => o.id === titleStyle)!;
    if (titleStyle === "custom") return customTitle.trim() || "Your custom masthead";
    return option.example(displayName.trim() || "Reader");
  }, [titleStyle, customTitle, displayName, kind, companyName]);

  function toggleInterest(id: string) {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function finish() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      setStep(0);
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      setStep(0);
      return;
    }
    if (kind === "company" && !companyName.trim()) {
      setError("Company name is required for a company paper.");
      setStep(0);
      return;
    }
    if (interests.length === 0) {
      setError("Pick at least one interest.");
      setStep(1);
      return;
    }

    const profile: UserProfile = {
      kind,
      name: name.trim(),
      email: email.trim(),
      titleStyle,
      customTitle: customTitle.trim() || undefined,
      interests,
      colorMode,
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

    saveProfile(profile);
    router.push("/edition");
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="mb-10 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
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
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em] text-[hsl(var(--ink))]">
              {kind === "company" ? "Company paper" : "Name your paper"}
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-[hsl(var(--muted-foreground))]">
              {kind === "company"
                ? "Build a private company newspaper from premium wires + Scrapling collection around your brand, market, and competitors."
                : "Your masthead, your interests, your printer. No ads. No filler."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["personal", "company"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`h-12 rounded-2xl border text-[14px] font-semibold capitalize ${
                  kind === value
                    ? "border-transparent bg-[hsl(var(--ink))] text-white"
                    : "border-black/[0.08] bg-white"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                {kind === "company" ? "Editor name" : "Your name"}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sairam"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
              />
            </label>
          </div>

          {kind === "company" ? (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Company name</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Robotics"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Industry</span>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Semiconductors"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                  Keywords (comma-separated)
                </span>
                <input
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="GPU, packaging, foundry, AI inference"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                  Competitors (comma-separated)
                </span>
                <input
                  value={competitorsText}
                  onChange={(e) => setCompetitorsText(e.target.value)}
                  placeholder="Competitor A, Competitor B"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
                  Custom masthead (optional)
                </span>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Acme Morning Brief"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Masthead style</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {TITLE_OPTIONS.map((option) => {
                  const active = titleStyle === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTitleStyle(option.id)}
                      className={`choice ${active ? "choice-active" : ""}`}
                    >
                      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                        {option.label}
                      </div>
                      <div className="font-display mt-1 text-[18px] font-semibold tracking-[-0.02em]">
                        {option.id === "custom"
                          ? "Write your own"
                          : option.example(name.trim() || "Reader")}
                      </div>
                    </button>
                  );
                })}
              </div>
              {titleStyle === "custom" ? (
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="The Midnight Dispatch"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none ring-[hsl(var(--apple-blue))] transition focus:ring-2"
                />
              ) : null}
            </div>
          )}

          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            Preview: <span className="font-display font-semibold text-[hsl(var(--ink))]">{previewTitle}</span>
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em] text-[hsl(var(--ink))]">
              What matters
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-[hsl(var(--muted-foreground))]">
              Sourced from BBC, Guardian, TechCrunch, AP/Bloomberg wires via Google News, plus Scrapling HTML desks.
            </p>
          </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
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
                    {mode === "bw" ? "Black & white" : "Color"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <div>
            <h1 className="font-display text-[clamp(2.4rem,6vw,3.5rem)] font-semibold tracking-[-0.03em] text-[hsl(var(--ink))]">
              Always-on delivery
            </h1>
            <p className="mt-3 max-w-md text-[16px] text-[hsl(var(--muted-foreground))]">
              News agent scrapes all day. Print daemon loops forever and sends jobs at your time — no click required.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Email time</span>
              <input
                type="time"
                value={emailTime}
                onChange={(e) => setEmailTime(e.target.value)}
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">Print time</span>
              <input
                type="time"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
                disabled={!printEnabled}
                className="h-12 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[15px] outline-none disabled:opacity-40"
              />
            </label>
          </div>
          <label className="choice flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-medium">Hands-free printer loop</div>
              <div className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                `npm run agent:print` discovers CUPS/IPP printers and auto-prints daily
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
              <div className="text-[15px] font-medium">Breaking desk (non-stop)</div>
              <div className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                `npm run agent:news` keeps Scrapling + premium wires running
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

      {error ? <p className="mt-6 text-[14px] font-medium text-[hsl(var(--destructive))]">{error}</p> : null}

      <div className="mt-12 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="btn-ghost disabled:opacity-30"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary">
            Continue
          </button>
        ) : (
          <button type="button" onClick={finish} className="btn-primary">
            Open today&apos;s edition
          </button>
        )}
      </div>
    </div>
  );
}
