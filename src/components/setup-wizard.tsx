"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { INTEREST_CATALOG } from "@/lib/interests";
import { TITLE_OPTIONS } from "@/lib/paper-titles";
import { saveProfile } from "@/lib/storage";
import type { ColorMode, PaperTitleStyle, UserProfile } from "@/lib/types";

const STEPS = ["Identity", "Interests", "Delivery"] as const;

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

  const previewTitle = useMemo(() => {
    const option = TITLE_OPTIONS.find((o) => o.id === titleStyle)!;
    if (titleStyle === "custom") return customTitle.trim() || "Your custom masthead";
    return option.example(name.trim() || "Reader");
  }, [titleStyle, customTitle, name]);

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
    if (interests.length === 0) {
      setError("Pick at least one interest.");
      setStep(1);
      return;
    }

    const profile: UserProfile = {
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
    };

    saveProfile(profile);
    router.push("/edition");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-10 flex items-center gap-3 font-ui text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`transition-colors ${index === step ? "text-ink" : "hover:text-ink/70"}`}
          >
            {String(index + 1).padStart(2, "0")} {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="animate-rise space-y-8">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Name your paper
            </h1>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your masthead, your interests, your printer. No ads. No filler.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sairam"
                className="h-11 rounded-sm bg-white"
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-sm bg-white"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Masthead style</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TITLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTitleStyle(option.id)}
                  className={`rounded-sm border px-4 py-3 text-left transition ${
                    titleStyle === option.id
                      ? "border-ink bg-ink text-primary-foreground"
                      : "border-border bg-white hover:border-ink/40"
                  }`}
                >
                  <div className="font-ui text-[10px] uppercase tracking-[0.16em] opacity-70">
                    {option.label}
                  </div>
                  <div className="font-display mt-1 text-lg leading-tight">
                    {option.id === "custom"
                      ? "Write your own"
                      : option.example(name.trim() || "Reader")}
                  </div>
                </button>
              ))}
            </div>
            {titleStyle === "custom" && (
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="The Midnight Dispatch"
                className="h-11 rounded-sm bg-white"
              />
            )}
            <p className="font-display text-sm text-muted-foreground">
              Preview: <span className="text-ink">{previewTitle}</span>
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="animate-rise space-y-8">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              What matters
            </h1>
            <p className="mt-3 max-w-lg text-muted-foreground">
              The AI Times filters for signal. Sponsored posts, shopping bait, and celebrity filler
              never make the fold.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTEREST_CATALOG.map((interest) => {
              const checked = interests.includes(interest.id);
              return (
                <label
                  key={interest.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition ${
                    checked ? "border-ink bg-white" : "border-border bg-white/70 hover:border-ink/30"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleInterest(interest.id)}
                  />
                  <span className="font-ui text-sm">{interest.label}</span>
                </label>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pages</Label>
              <select
                className="flex h-11 w-full rounded-sm border border-input bg-white px-3 text-sm"
                value={pageCount === "auto" ? "auto" : String(pageCount)}
                onChange={(e) =>
                  setPageCount(e.target.value === "auto" ? "auto" : Number(e.target.value))
                }
              >
                <option value="auto">Auto</option>
                {[2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} pages
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Print color</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["bw", "color"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setColorMode(mode)}
                    className={`h-11 rounded-sm border text-sm ${
                      colorMode === mode ? "border-ink bg-ink text-primary-foreground" : "bg-white"
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
        <div className="animate-rise space-y-8">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Morning ritual
            </h1>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Email arrives first. The print agent can send the same edition to your printer a few
              minutes later.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emailTime">Email time</Label>
              <Input
                id="emailTime"
                type="time"
                value={emailTime}
                onChange={(e) => setEmailTime(e.target.value)}
                className="h-11 rounded-sm bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printTime">Print time</Label>
              <Input
                id="printTime"
                type="time"
                value={printTime}
                onChange={(e) => setPrintTime(e.target.value)}
                disabled={!printEnabled}
                className="h-11 rounded-sm bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-sm border border-border bg-white px-4 py-3">
            <div>
              <div className="font-ui text-sm">Daily printer run</div>
              <div className="text-xs text-muted-foreground">
                Queues a job for `npm run print-agent`
              </div>
            </div>
            <Switch checked={printEnabled} onCheckedChange={setPrintEnabled} />
          </div>

          <div className="flex items-center justify-between rounded-sm border border-border bg-white px-4 py-3">
            <div>
              <div className="font-ui text-sm">Breaking news alerts</div>
              <div className="text-xs text-muted-foreground">
                Immediate email when urgent stories match your interests
              </div>
            </div>
            <Switch checked={breakingNews} onCheckedChange={setBreakingNews} />
          </div>
        </div>
      )}

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-sm"
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-sm px-6">
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={finish} className="rounded-sm px-6">
            Open today&apos;s edition
          </Button>
        )}
      </div>
    </div>
  );
}
