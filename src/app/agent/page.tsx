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
import {
  DEFAULT_DELIVERY,
  type DeliveryState,
  loadDeliveryLocal,
  saveDeliveryLocal,
} from "@/lib/delivery";
import { loadProfile, saveProfile } from "@/lib/storage";

type Printer = {
  id: string;
  name: string;
  driver?: string;
  uri?: string;
  isDefault?: boolean;
  connected?: boolean;
  status?: string;
};

type ControlStatus = {
  dailyOn?: boolean;
  agents?: Record<string, { running?: boolean; pid?: number | null; label?: string }>;
  lastRun?: {
    updatedAt?: string;
    lastEmail?: { mode?: string };
    lastPrint?: { mode?: string; file?: string; printer?: string };
  } | null;
};

export default function AgentPage() {
  const profile = useMemo(() => loadProfile(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [control, setControl] = useState<ControlStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [delivery, setDelivery] = useState<DeliveryState>(DEFAULT_DELIVERY);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [ippName, setIppName] = useState("Home printer");
  const [ippUri, setIppUri] = useState("ipp://192.168.1.50/ipp/print");

  const [form, setForm] = useState({
    name: "Morning paper",
    email: profile?.email || "",
    emailTime: profile?.emailTime || "06:00",
    printTime: profile?.printTime || "06:05",
    printEnabled: profile?.printEnabled ?? true,
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  });

  const refresh = useCallback(async () => {
    const [ctrl, remote, del] = await Promise.all([
      fetch("/api/agent/control").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      fetch("/api/delivery").then((r) => r.json()),
    ]);
    setControl(ctrl);
    setPrinters(del.printers || []);
    const d: DeliveryState = { ...DEFAULT_DELIVERY, ...(del.delivery || {}) };
    setDelivery(d);
    saveDeliveryLocal(d);
    if (d.printerId) setSelectedPrinter(d.printerId);
    else if (del.printers?.[0]?.id) setSelectedPrinter(del.printers[0].id);

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
    if (merged.agents?.[0]) {
      const a = merged.agents[0];
      setForm((f) => ({
        ...f,
        name: a.name || f.name,
        emailTime: a.emailTime || f.emailTime,
        printTime: a.printTime || f.printTime,
        printEnabled: a.printEnabled,
        timezone: a.timezone || f.timezone,
      }));
    }
  }, []);

  useEffect(() => {
    setDelivery(loadDeliveryLocal());
    void refresh();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function persistSchedule() {
    if (!form.email.includes("@")) {
      throw new Error("Add the email that should get the paper every morning.");
    }
    const agent: DeliveryAgent = {
      id: settings.agents[0]?.id || `agent-${Date.now().toString(36)}`,
      name: form.name.trim() || "Morning paper",
      enabled: true,
      emailTime: form.emailTime,
      printTime: form.printTime,
      printEnabled: form.printEnabled,
      printerId: delivery.printerId || selectedPrinter || undefined,
      timezone: form.timezone,
      createdAt: settings.agents[0]?.createdAt || new Date().toISOString(),
    };
    const next: AppSettings = {
      ...settings,
      agents: [agent, ...settings.agents.filter((a) => a.id !== agent.id)],
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
      name: "Reader",
      email: form.email,
      titleStyle: "the-times" as const,
      interests: ["technology", "world", "business"],
      colorMode: "bw" as const,
      emailTime: form.emailTime,
      printEnabled: form.printEnabled,
      printTime: form.printTime,
      printerId: agent.printerId,
      timezone: form.timezone,
      pageCount: "auto" as const,
      breakingNews: true,
      createdAt: new Date().toISOString(),
    };
    saveProfile({
      ...base,
      email: form.email,
      emailTime: form.emailTime,
      printTime: form.printTime,
      printEnabled: form.printEnabled,
      printerId: agent.printerId,
      timezone: form.timezone,
    });
  }

  async function deliveryAction(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delivery action failed");
      if (data.delivery) {
        setDelivery(data.delivery);
        saveDeliveryLocal(data.delivery);
      }
      if (data.printers) setPrinters(data.printers);
      setMessage(data.message || "Updated.");
      void refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function turnOnDaily() {
    setBusy(true);
    setMessage("Saving schedule and starting everyday agents…");
    try {
      await persistSchedule();
      if (selectedPrinter) {
        const connect = await fetch("/api/delivery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "connect_printer", printerId: selectedPrinter }),
        });
        const connectData = await connect.json();
        if (connect.ok && connectData.delivery) {
          setDelivery(connectData.delivery);
          saveDeliveryLocal(connectData.delivery);
        }
      }
      const res = await fetch("/api/agent/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", agents: ["morning", "news", "print"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start");
      setControl(data);
      setMessage(
        `Everyday agent ON. Email ${form.emailTime} → print ${form.printTime} to ${
          selectedPrinter || delivery.printerName || "your printer"
        }. Pause when you’re away.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Start failed");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function runOnce() {
    setBusy(true);
    setMessage("Running generate → email → print now…");
    try {
      await persistSchedule();
      const res = await fetch("/api/agent/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "once" }),
      });
      const data = await res.json();
      setControl(data);
      setMessage(data.ok ? "Done — check inbox / print-output / latest edition." : "Finished with issues.");
      window.open("/editions/latest.html", "_blank");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  const dailyOn = Boolean(control?.dailyOn || control?.agents?.morning?.running);
  const paused = Boolean(delivery.paused);
  const hasRealPrinter = Boolean(
    delivery.printerId && delivery.printerId !== "ai-times-pdf",
  );

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
          Everyday print system
        </p>
        <h1 className="font-display mt-2 text-[clamp(2.1rem,6vw,3rem)] font-semibold tracking-[-0.03em]">
          Connect a printer once. Pause when you’re away.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Setup is one-time: pick the home or office printer you own. Every morning the agent sends
          today’s A4 paper to that same printer. Hit Pause so nothing prints while you’re traveling.
        </p>

        {/* Status + Pause/Play */}
        <div
          className={`mt-8 rounded-3xl border px-5 py-5 ${
            paused
              ? "border-amber-200 bg-amber-50/80"
              : dailyOn
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-black/[0.06] bg-white/80"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-wide">
                {paused
                  ? delivery.pauseMode === "all"
                    ? "Paused · all delivery"
                    : "Paused · printing only"
                  : dailyOn
                    ? "Live · prints every day"
                    : "Off · not running yet"}
              </div>
              <p className="mt-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                {delivery.printerName || delivery.printerId
                  ? `Printer: ${delivery.printerName || delivery.printerId}`
                  : "No home/office printer connected yet — use the setup below."}
              </p>
              <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                Schedule: email {form.emailTime} · print {form.printTime} · {form.timezone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {paused ? (
                <Button type="button" disabled={busy} onClick={() => void deliveryAction({ action: "resume" })}>
                  ▶ Resume printing
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void deliveryAction({ action: "pause", pauseMode: "print" })}
                >
                  ⏸ Pause printing
                </Button>
              )}
              {!paused ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void deliveryAction({ action: "pause", pauseMode: "all" })}
                >
                  Pause all
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <strong className="text-[hsl(var(--ink))]">Pause printing</strong> = you’re not home; email can
            still arrive, the physical printer stays quiet.{" "}
            <strong className="text-[hsl(var(--ink))]">Pause all</strong> = skip generate/email/print until
            Play. <strong className="text-[hsl(var(--ink))]">Resume</strong> arms everyday print again.
          </p>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-3 text-[13px] text-[hsl(var(--apple-blue))]">
            {message}
          </p>
        ) : null}

        {/* How it works */}
        <section className="surface mt-8 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
            How everyday print works
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <li>
              <strong className="text-[hsl(var(--ink))]">Connect your printer once</strong> — discover
              CUPS printers on this Mac/PC, or add a home/office network printer with its IPP address
              (usually on the printer sticker or router page).
            </li>
            <li>
              <strong className="text-[hsl(var(--ink))]">Turn on every day</strong> — the morning agent
              stays running on this machine (or a small always-on PC/NAS at home).
            </li>
            <li>
              At print time it sends today’s paper to <em>that same printer</em> — no open browser, no
              daily reconnect.
            </li>
            <li>
              Leaving town? <strong className="text-[hsl(var(--ink))]">Pause printing</strong>. Back home?
              Resume.
            </li>
          </ol>
          {!hasRealPrinter ? (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              PDF fallback is only for testing. Connect a real home/office printer below so mornings
              actually print on paper.
            </p>
          ) : null}
        </section>

        {/* Printer connect once */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
            1. Connect home / office printer
          </h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Do this once. Everyday jobs reuse this printer automatically.
          </p>

          <div className="mt-5 space-y-3">
            {printers.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No printers found yet — Discover, or add IPP below.
              </p>
            ) : (
              printers.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${
                    selectedPrinter === p.id
                      ? "border-[hsl(var(--apple-blue))] bg-blue-50/40"
                      : "border-black/[0.06]"
                  }`}
                >
                  <input
                    type="radio"
                    name="printer"
                    className="mt-1"
                    checked={selectedPrinter === p.id}
                    onChange={() => setSelectedPrinter(p.id)}
                  />
                  <div>
                    <div className="text-[14px] font-medium">
                      {p.name}
                      {delivery.printerId === p.id ? " · connected" : ""}
                      {p.isDefault ? " · default" : ""}
                    </div>
                    <div className="text-[12px] text-[hsl(var(--muted-foreground))]">
                      {p.id} · {p.driver || "file"}
                      {p.uri ? ` · ${p.uri}` : ""}
                      {p.id === "ai-times-pdf" ? " · test fallback (not a real printer)" : ""}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !selectedPrinter}
              onClick={() =>
                void deliveryAction({
                  action: "connect_printer",
                  printerId: selectedPrinter,
                })
              }
            >
              Connect this printer
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await fetch("/api/print/printers?discover=1");
                  const data = await res.json();
                  setPrinters(data.printers || []);
                  setMessage(`Found ${(data.printers || []).length} printer(s).`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Discover
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void deliveryAction({
                  action: "test_print",
                  printerId: selectedPrinter || delivery.printerId || undefined,
                })
              }
            >
              Test print
            </Button>
          </div>

          <div className="mt-8 border-t border-black/[0.06] pt-6">
            <h3 className="text-[14px] font-semibold">Add network printer (IPP)</h3>
            <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
              For Wi‑Fi / office printers. Example: <code>ipp://192.168.1.50/ipp/print</code> or{" "}
              <code>ipps://printer.local:631/ipp/print</code>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input className="mt-1.5" value={ippName} onChange={(e) => setIppName(e.target.value)} />
              </div>
              <div>
                <Label>IPP address</Label>
                <Input className="mt-1.5" value={ippUri} onChange={(e) => setIppUri(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void deliveryAction({
                  action: "add_ipp",
                  name: ippName,
                  uri: ippUri,
                  setDefault: true,
                })
              }
            >
              Add & connect IPP printer
            </Button>
          </div>
        </section>

        {/* Schedule */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">2. Everyday schedule</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Send paper to</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <Label>Email time</Label>
              <Input
                className="mt-1.5"
                type="time"
                value={form.emailTime}
                onChange={(e) => setForm({ ...form, emailTime: e.target.value })}
              />
            </div>
            <div>
              <Label>Print time</Label>
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
              <div className="text-[14px] font-medium">Print after email</div>
              <div className="text-[12px] text-[hsl(var(--muted-foreground))]">
                Uses the connected printer above
              </div>
            </div>
            <Switch
              checked={form.printEnabled}
              onCheckedChange={(v) => setForm({ ...form, printEnabled: v })}
            />
          </div>
        </section>

        {/* Turn on */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">3. Turn on / prove it</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" disabled={busy || dailyOn} onClick={() => void turnOnDaily()}>
              {dailyOn ? "Everyday agent already on" : "Turn on every day"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void runOnce()}>
              Run once now
            </Button>
            {dailyOn ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await fetch("/api/agent/control", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "stop" }),
                    });
                    setMessage("Everyday agents stopped.");
                    void refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Stop agents
              </Button>
            ) : null}
          </div>
          <div className="mt-5 grid gap-2 text-[12px] text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
            {(["morning", "news", "print"] as const).map((key) => (
              <div key={key} className="rounded-xl bg-black/[0.03] px-3 py-2">
                <span className="font-medium capitalize">{key}</span>
                {": "}
                {control?.agents?.[key]?.running ? "running" : "stopped"}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Keep this computer on (or run the agents on a home server). You don’t need the website open.
            SMTP for real email is under{" "}
            <Link href="/settings" className="underline">
              Settings → Email
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
