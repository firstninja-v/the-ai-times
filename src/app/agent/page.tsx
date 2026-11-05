"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DeliveryAgent,
  loadSettings,
  saveSettingsLocal,
} from "@/lib/settings";
import { loadProfile, saveProfile } from "@/lib/storage";

type ControlStatus = {
  dailyOn?: boolean;
  agents?: Record<string, { running?: boolean; pid?: number | null; label?: string }>;
  deliveryAgents?: DeliveryAgent[];
  lastRun?: {
    updatedAt?: string;
    lastEmail?: { mode?: string; to?: string };
    lastPrint?: { mode?: string; file?: string };
  } | null;
  howItWorks?: string[];
};

const STEPS = ["Schedule", "Delivery", "Turn on"] as const;

export default function AgentPage() {
  const profile = useMemo(() => loadProfile(), []);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [control, setControl] = useState<ControlStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [form, setForm] = useState({
    name: "Morning paper",
    email: profile?.email || "",
    emailTime: profile?.emailTime || "06:00",
    printTime: profile?.printTime || "06:05",
    printEnabled: profile?.printEnabled ?? true,
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpEnabled: false,
    printerId: profile?.printerId || "ai-times-pdf",
  });

  const refresh = useCallback(async () => {
    const [ctrl, remote] = await Promise.all([
      fetch("/api/agent/control").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]);
    setControl(ctrl);
    const local = loadSettings();
    const merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...local,
      ...remote,
      email: { ...DEFAULT_SETTINGS.email, ...local.email, ...(remote.email || {}) },
      share: local.share || remote.share || DEFAULT_SETTINGS.share,
      agents: remote.agents?.length ? remote.agents : local.agents,
    };
    setSettings(merged);
    if (merged.email?.user) {
      setForm((f) => ({
        ...f,
        smtpHost: merged.email.host || f.smtpHost,
        smtpPort: merged.email.port || f.smtpPort,
        smtpUser: merged.email.user || f.smtpUser,
        smtpFrom: merged.email.from || f.smtpFrom,
        smtpEnabled: Boolean(merged.email.enabled),
        smtpPass: merged.email.pass === "••••••••" ? "••••••••" : f.smtpPass,
      }));
    }
    if (merged.agents?.[0]) {
      const a = merged.agents[0];
      setForm((f) => ({
        ...f,
        name: a.name || f.name,
        emailTime: a.emailTime || f.emailTime,
        printTime: a.printTime || f.printTime,
        printEnabled: a.printEnabled,
        timezone: a.timezone || f.timezone,
        printerId: a.printerId || f.printerId,
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function persistSchedule() {
    if (!form.email.includes("@")) {
      throw new Error("Add the email address that should receive the paper every morning.");
    }
    const agent: DeliveryAgent = {
      id: settings.agents[0]?.id || `agent-${Date.now().toString(36)}`,
      name: form.name.trim() || "Morning paper",
      enabled: true,
      emailTime: form.emailTime,
      printTime: form.printTime,
      printEnabled: form.printEnabled,
      printerId: form.printerId,
      timezone: form.timezone,
      createdAt: settings.agents[0]?.createdAt || new Date().toISOString(),
    };
    const next: AppSettings = {
      ...settings,
      agents: [agent, ...settings.agents.filter((a) => a.id !== agent.id)],
      email: {
        ...settings.email,
        enabled: form.smtpEnabled,
        host: form.smtpHost,
        port: form.smtpPort,
        user: form.smtpUser,
        pass: form.smtpPass,
        from: form.smtpFrom || form.smtpUser || form.email,
        secure: false,
      },
    };
    saveSettingsLocal(next);
    setSettings(next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const base = loadProfile() || {
      kind: "personal" as const,
      name: form.name.replace(/\s+paper$/i, "") || "Reader",
      email: form.email,
      titleStyle: "the-times" as const,
      interests: ["technology", "world", "business"],
      newsPrompt: "Useful morning coverage. Skip celebrity gossip.",
      colorMode: "bw" as const,
      emailTime: form.emailTime,
      printEnabled: form.printEnabled,
      printTime: form.printTime,
      printerId: form.printerId,
      timezone: form.timezone,
      pageCount: "auto" as const,
      breakingNews: true,
      contentVolume: "more" as const,
      createdAt: new Date().toISOString(),
    };
    saveProfile({
      ...base,
      email: form.email,
      emailTime: form.emailTime,
      printTime: form.printTime,
      printEnabled: form.printEnabled,
      printerId: form.printerId,
      timezone: form.timezone,
    });
  }

  async function saveSchedule() {
    setBusy(true);
    setMessage(null);
    try {
      await persistSchedule();
      setMessage(`Saved. Every day at ${form.emailTime} (${form.timezone}) the paper emails ${form.email}.`);
      setStep(2);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save schedule");
    } finally {
      setBusy(false);
    }
  }

  async function turnOnDaily() {
    setBusy(true);
    setMessage("Starting daily agents…");
    try {
      await persistSchedule();
      const res = await fetch("/api/agent/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", agents: ["morning", "news", "print"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start daily agent");
      setControl(data);
      setMessage(
        data.dailyOn || data.agents?.morning?.running
          ? `Daily agent is ON. It will generate → email at ${form.emailTime}, then print at ${form.printTime}, every day. Keep this computer running (or host the agents on a server).`
          : "Started — refresh status in a moment.",
      );
      setStep(2);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function turnOffDaily() {
    setBusy(true);
    try {
      const res = await fetch("/api/agent/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      setControl(data);
      setMessage("Daily agent stopped. It will not run tomorrow until you turn it back on.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }

  async function runOnce() {
    setBusy(true);
    setMessage("Running today’s paper now (generate → email → print)…");
    try {
      const res = await fetch("/api/agent/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "once" }),
      });
      const data = await res.json();
      setControl(data);
      setMessage(
        data.ok
          ? "Done. Check your inbox (or the local email preview) and print-output / latest edition."
          : `Finished with issues: ${(data.stderr || data.stdout || "").slice(0, 180)}`,
      );
      window.open("/editions/latest.html", "_blank");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const dailyOn = Boolean(control?.dailyOn || control?.agents?.morning?.running);
  const nextLine = form.email
    ? `Every day · email ${form.email} at ${form.emailTime} · print ${form.printTime} · ${form.timezone}`
    : "Set your email and times below, then turn the daily agent on.";

  return (
    <main className="min-h-screen pb-24">
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/settings" className="btn-ghost hidden sm:inline-flex">
              Settings
            </Link>
            <Link href="/edition" className="btn-secondary !h-10 !px-4 !text-[13px]">
              Today’s paper
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--apple-blue))]">
          Daily agent
        </p>
        <h1 className="font-display mt-2 text-[clamp(2.1rem,6vw,3rem)] font-semibold tracking-[-0.03em]">
          Make the paper arrive every morning
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          One agent. Runs every day. Generates your A4 paper, emails it, then prints — without opening
          this site again.
        </p>

        {/* Live status */}
        <div
          className={`mt-8 rounded-3xl border px-5 py-4 ${
            dailyOn ? "border-emerald-200 bg-emerald-50/70" : "border-black/[0.06] bg-white/80"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold tracking-wide uppercase">
                {dailyOn ? "Daily agent · ON" : "Daily agent · OFF"}
              </div>
              <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">{nextLine}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {dailyOn ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void turnOffDaily()}>
                  Turn off
                </Button>
              ) : (
                <Button type="button" disabled={busy} onClick={() => void turnOnDaily()}>
                  Turn on every day
                </Button>
              )}
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void runOnce()}>
                Run once now
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-[12px] text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
            {(["morning", "news", "print"] as const).map((key) => (
              <div key={key} className="rounded-xl bg-black/[0.03] px-3 py-2">
                <span className="font-medium capitalize">{key}</span>
                {": "}
                {control?.agents?.[key]?.running ? "running" : "stopped"}
              </div>
            ))}
          </div>
          {control?.lastRun?.updatedAt ? (
            <p className="mt-3 text-[12px] text-[hsl(var(--muted-foreground))]">
              Last activity {new Date(control.lastRun.updatedAt).toLocaleString()}
              {control.lastRun.lastEmail?.mode ? ` · email ${control.lastRun.lastEmail.mode}` : ""}
              {control.lastRun.lastPrint?.mode ? ` · print ${control.lastRun.lastPrint.mode}` : ""}
            </p>
          ) : null}
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-3 text-[13px] text-[hsl(var(--apple-blue))]">
            {message}
          </p>
        ) : null}

        {/* Steps */}
        <div className="mt-8 flex gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                step === i
                  ? "bg-[hsl(var(--ink))] text-white"
                  : "bg-black/[0.04] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 ? (
          <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">1. Everyday schedule</h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Pick when the paper should email and print. Same times, every day.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Agent name</Label>
                <Input
                  className="mt-1.5"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Send paper to this email</Label>
                <Input
                  className="mt-1.5"
                  type="email"
                  placeholder="you@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Email time (every day)</Label>
                <Input
                  className="mt-1.5"
                  type="time"
                  value={form.emailTime}
                  onChange={(e) => setForm({ ...form, emailTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Print time (every day)</Label>
                <Input
                  className="mt-1.5"
                  type="time"
                  value={form.printTime}
                  onChange={(e) => setForm({ ...form, printTime: e.target.value })}
                  disabled={!form.printEnabled}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Timezone</Label>
                <Input
                  className="mt-1.5"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium">Also print after email</div>
                <div className="text-[12px] text-[hsl(var(--muted-foreground))]">
                  Uses your connected printer (or PDF fallback)
                </div>
              </div>
              <Switch
                checked={form.printEnabled}
                onCheckedChange={(v) => setForm({ ...form, printEnabled: v })}
              />
            </div>
            <Button type="button" className="mt-6" disabled={busy} onClick={() => setStep(1)}>
              Next: delivery
            </Button>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">2. How it gets delivered</h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Email is optional but recommended. Free path: Gmail App Password. Without SMTP the agent
              still runs and writes a local email preview.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium">Send real email (Gmail SMTP)</div>
                <div className="text-[12px] text-[hsl(var(--muted-foreground))]">
                  Google Account → Security → App passwords
                </div>
              </div>
              <Switch
                checked={form.smtpEnabled}
                onCheckedChange={(v) => setForm({ ...form, smtpEnabled: v })}
              />
            </div>

            {form.smtpEnabled ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>SMTP host</Label>
                  <Input
                    className="mt-1.5"
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    className="mt-1.5"
                    value={form.smtpUser}
                    onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                    placeholder={form.email}
                  />
                </div>
                <div>
                  <Label>App password</Label>
                  <Input
                    className="mt-1.5"
                    type="password"
                    value={form.smtpPass}
                    onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-6">
              <Label>Printer id</Label>
              <Input
                className="mt-1.5"
                value={form.printerId}
                onChange={(e) => setForm({ ...form, printerId: e.target.value })}
              />
              <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                Default <code>ai-times-pdf</code> always works. Discover real printers in{" "}
                <Link href="/settings" className="underline">
                  Settings → Printer
                </Link>
                .
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="button" disabled={busy} onClick={() => void saveSchedule()}>
                Save & continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">3. Turn it on</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              <li>
                Click <strong className="text-[hsl(var(--ink))]">Turn on every day</strong> — starts the
                morning, news, and print agents on this machine.
              </li>
              <li>
                Leave the computer on (or deploy the same agents on a always-on host). You do{" "}
                <strong className="text-[hsl(var(--ink))]">not</strong> need to keep the website open.
              </li>
              <li>
                At {form.emailTime} it builds the paper and emails {form.email || "you"}. At{" "}
                {form.printTime} it prints.
              </li>
              <li>
                Optional: click <strong className="text-[hsl(var(--ink))]">Run once now</strong> to prove
                the loop before tomorrow morning.
              </li>
            </ol>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" disabled={busy || dailyOn} onClick={() => void turnOnDaily()}>
                {dailyOn ? "Already on" : "Turn on every day"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void runOnce()}>
                Run once now
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep(0)}>
                Edit schedule
              </Button>
            </div>

            <div className="mt-8 rounded-2xl bg-black/[0.03] p-4 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              <div className="font-medium text-[hsl(var(--ink))]">How users make it work</div>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {(control?.howItWorks || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li>
                  Advanced / server: <code>npm run agent:morning</code> · <code>npm run agent:news</code> ·{" "}
                  <code>npm run agent:print</code>
                </li>
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
