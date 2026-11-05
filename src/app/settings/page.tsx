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

type Printer = {
  id: string;
  name: string;
  driver?: string;
  isDefault?: boolean;
  status?: string;
  settings?: {
    paperSize?: string;
    colorMode?: string;
    duplex?: boolean;
    copies?: number;
    autoPrint?: boolean;
  };
};

type AgentStatus = {
  morning?: { updatedAt?: string; lastPrint?: { mode?: string; file?: string }; lastEmail?: { mode?: string } } | null;
  print?: { updatedAt?: string } | null;
  news?: { updatedAt?: string } | null;
  printers?: { printers?: Printer[] } | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentDraft, setAgentDraft] = useState({
    name: "Morning Delivery",
    emailTime: "06:00",
    printTime: "06:05",
    printEnabled: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  });
  const [emailPassDirty, setEmailPassDirty] = useState(false);

  const profileEmail = useMemo(() => loadProfile()?.email || "", []);

  const refreshPrinters = useCallback(async () => {
    const res = await fetch("/api/print/printers");
    const data = await res.json();
    const list: Printer[] = data.printers || [];
    setPrinters(list);
    const def = list.find((p) => p.isDefault) || list[0];
    if (def) setSelectedPrinter((prev) => prev || def.id);
  }, []);

  const refreshAgentStatus = useCallback(async () => {
    const res = await fetch("/api/agent/run");
    const data = await res.json();
    setAgentStatus(data);
  }, []);

  const loadRemote = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const remote = await res.json();
      const local = loadSettings();
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...local,
        ...remote,
        email: { ...DEFAULT_SETTINGS.email, ...local.email, ...(remote.email || {}) },
        share: {
          ...DEFAULT_SETTINGS.share,
          ...local.share,
          ...(remote.share || {}),
          slack: {
            ...DEFAULT_SETTINGS.share.slack,
            ...(local.share?.slack || {}),
            ...(remote.share?.slack || {}),
          },
          whatsapp: {
            ...DEFAULT_SETTINGS.share.whatsapp,
            ...(local.share?.whatsapp || {}),
            ...(remote.share?.whatsapp || {}),
          },
        },
        agents: remote.agents?.length ? remote.agents : local.agents,
      };
      if (remote.emailHasPass && !emailPassDirty) {
        merged.email.pass = "••••••••";
      }
      setSettings(merged);
      saveSettingsLocal(merged);
    } catch {
      setSettings(loadSettings());
    }
  }, [emailPassDirty]);

  useEffect(() => {
    void loadRemote();
    void refreshPrinters();
    void refreshAgentStatus();
  }, [loadRemote, refreshPrinters, refreshAgentStatus]);

  async function persist(next: AppSettings) {
    setSettings(next);
    saveSettingsLocal(next);
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Settings saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function createAgent() {
    const id = `agent-${Date.now().toString(36)}`;
    const agent: DeliveryAgent = {
      id,
      name: agentDraft.name.trim() || "Morning Delivery",
      enabled: true,
      emailTime: agentDraft.emailTime,
      printTime: agentDraft.printTime,
      printEnabled: agentDraft.printEnabled,
      printerId: selectedPrinter || undefined,
      timezone: agentDraft.timezone,
      createdAt: new Date().toISOString(),
    };
    const next = { ...settings, agents: [...settings.agents, agent] };
    await persist(next);

    // Mirror into the profile the morning daemon already watches
    const profile = loadProfile();
    if (profile) {
      saveProfile({
        ...profile,
        emailTime: agent.emailTime,
        printTime: agent.printTime,
        printEnabled: agent.printEnabled,
        printerId: agent.printerId,
        timezone: agent.timezone,
      });
      await fetch("/api/profile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          emailTime: agent.emailTime,
          printTime: agent.printTime,
          printEnabled: agent.printEnabled,
          printerId: agent.printerId,
          timezone: agent.timezone,
        }),
      });
    }
    setStatus(`Agent “${agent.name}” created. Morning loop will email at ${agent.emailTime} and print at ${agent.printTime}.`);
    void refreshAgentStatus();
  }

  async function savePrinter() {
    if (!selectedPrinter) return;
    setBusy(true);
    try {
      const current = printers.find((p) => p.id === selectedPrinter);
      const res = await fetch("/api/print/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerId: selectedPrinter,
          settings: {
            paperSize: current?.settings?.paperSize || "A4",
            colorMode: current?.settings?.colorMode || "bw",
            duplex: current?.settings?.duplex || false,
            copies: current?.settings?.copies || 1,
            orientation: "portrait",
            autoPrint: true,
          },
          setDefault: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Printer save failed");
      setPrinters(data.printers || printers);
      // Attach to first enabled agent + profile
      const agents = settings.agents.map((a, i) =>
        i === 0 || a.enabled ? { ...a, printerId: selectedPrinter } : a,
      );
      await persist({ ...settings, agents });
      const profile = loadProfile();
      if (profile) {
        saveProfile({ ...profile, printerId: selectedPrinter, printEnabled: true });
      }
      setStatus(`Printer connected: ${selectedPrinter}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Printer connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function discoverPrinters() {
    setBusy(true);
    setStatus("Discovering printers…");
    try {
      const res = await fetch("/api/print/printers?discover=1");
      const data = await res.json();
      setPrinters(data.printers || []);
      setStatus(`Found ${(data.printers || []).length} printer(s).`);
    } catch {
      setStatus("Printer discovery failed.");
    } finally {
      setBusy(false);
    }
  }

  async function testPrint() {
    setBusy(true);
    setStatus("Sending test print…");
    try {
      const profile = loadProfile();
      if (!profile) throw new Error("Finish setup first so we have a paper profile.");
      const res = await fetch("/api/print/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, printerId: selectedPrinter || profile.printerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Print failed");
      // Also open browser print for immediate feedback
      window.open("/editions/latest.html", "_blank");
      setStatus(`Print queued (${data.pages} pages). Latest edition opened for Print → Save as PDF / your printer.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Test print failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAgentOnce() {
    setBusy(true);
    setStatus("Running morning agent once (generate → email → print)…");
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "once" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed");
      setStatus(
        data.ok
          ? "Agent finished. Check edition, email preview, and print-output."
          : `Agent exited with code ${data.code}. ${data.stderr || data.stdout || ""}`.slice(0, 280),
      );
      void refreshAgentStatus();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setBusy(false);
    }
  }

  async function share(channel: "slack" | "whatsapp" | "email" | "link") {
    setBusy(true);
    try {
      // Persist share settings first so Slack webhook is available server-side
      await persist(settings);
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, editionUrl: "/editions/latest.html" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Share failed");
      if (channel === "slack") {
        setStatus("Posted to Slack.");
      } else if (channel === "link") {
        await navigator.clipboard.writeText(data.url);
        setStatus("Edition link copied.");
      } else if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setStatus(channel === "whatsapp" ? "Opened WhatsApp share." : "Opened email draft.");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-20">
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/studio" className="btn-ghost hidden sm:inline-flex">
              Studio
            </Link>
            <Link href="/edition" className="btn-secondary !h-10 !px-4 !text-[13px]">
              Open edition
            </Link>
          </div>
        }
      />

      <div className="mx-auto max-w-3xl px-5 pt-10 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--apple-blue))]">
          Control plane
        </p>
        <h1 className="font-display mt-2 text-[clamp(2rem,5vw,2.75rem)] font-semibold tracking-[-0.03em]">
          Settings
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Create a delivery agent, connect a printer, add free email (Gmail SMTP), and share today’s
          paper to WhatsApp, Slack, or anywhere with a link.
        </p>
        {status ? (
          <p className="mt-4 rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3 text-[13px] text-[hsl(var(--apple-blue))]">
            {status}
          </p>
        ) : null}

        {/* Agents */}
        <section className="surface mt-10 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Delivery agent</h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            One agent generates the paper, emails it, then sends it to your printer on a schedule.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                className="mt-1.5"
                value={agentDraft.name}
                onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agent-tz">Timezone</Label>
              <Input
                id="agent-tz"
                className="mt-1.5"
                value={agentDraft.timezone}
                onChange={(e) => setAgentDraft({ ...agentDraft, timezone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email-time">Email time</Label>
              <Input
                id="email-time"
                type="time"
                className="mt-1.5"
                value={agentDraft.emailTime}
                onChange={(e) => setAgentDraft({ ...agentDraft, emailTime: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="print-time">Print time</Label>
              <Input
                id="print-time"
                type="time"
                className="mt-1.5"
                value={agentDraft.printTime}
                onChange={(e) => setAgentDraft({ ...agentDraft, printTime: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-medium">Print after email</div>
              <div className="text-[12px] text-[hsl(var(--muted-foreground))]">Uses the connected printer below</div>
            </div>
            <Switch
              checked={agentDraft.printEnabled}
              onCheckedChange={(v) => setAgentDraft({ ...agentDraft, printEnabled: v })}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void createAgent()} disabled={busy}>
              Create agent
            </Button>
            <Button type="button" variant="secondary" onClick={() => void runAgentOnce()} disabled={busy}>
              Run once now
            </Button>
          </div>

          {settings.agents.length > 0 ? (
            <ul className="mt-6 space-y-3 border-t border-black/[0.06] pt-5">
              {settings.agents.map((agent) => (
                <li key={agent.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-[hsl(var(--muted-foreground))]">
                      Email {agent.emailTime} · Print {agent.printTime}
                      {agent.printerId ? ` · ${agent.printerId}` : ""} · {agent.timezone}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[12px] text-red-600"
                    onClick={() =>
                      void persist({
                        ...settings,
                        agents: settings.agents.filter((a) => a.id !== agent.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {agentStatus ? (
            <div className="mt-5 grid gap-2 rounded-2xl bg-black/[0.03] p-4 text-[12px] text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
              <div>
                Morning: {agentStatus.morning?.updatedAt ? "online" : "idle"}
                {agentStatus.morning?.lastEmail?.mode
                  ? ` · last email ${agentStatus.morning.lastEmail.mode}`
                  : ""}
              </div>
              <div>Print daemon: {agentStatus.print?.updatedAt ? "online" : "idle"}</div>
              <div>News desk: {agentStatus.news?.updatedAt ? "online" : "idle"}</div>
            </div>
          ) : null}
        </section>

        {/* Printer */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Printer</h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Connect CUPS/IPP printers when available, or use the PDF fallback and print from your browser.
          </p>
          <div className="mt-5 space-y-3">
            {printers.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">No printers yet — discover or use PDF fallback.</p>
            ) : (
              printers.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${
                    selectedPrinter === p.id ? "border-[hsl(var(--apple-blue))] bg-blue-50/40" : "border-black/[0.06]"
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
                      {p.name} {p.isDefault ? "· default" : ""}
                    </div>
                    <div className="text-[12px] text-[hsl(var(--muted-foreground))]">
                      {p.id} · {p.driver || "file"} · {p.status || "ready"}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void savePrinter()} disabled={busy || !selectedPrinter}>
              Connect printer
            </Button>
            <Button type="button" variant="secondary" onClick={() => void discoverPrinters()} disabled={busy}>
              Discover
            </Button>
            <Button type="button" variant="secondary" onClick={() => void testPrint()} disabled={busy}>
              Test print
            </Button>
          </div>
        </section>

        {/* Email */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Email (free SMTP)</h2>
              <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
                Use a free Gmail App Password, Outlook, or any SMTP host. Without SMTP we still write a local
                preview file so the agent keeps working.
              </p>
            </div>
            <Switch
              checked={settings.email.enabled}
              onCheckedChange={(enabled) => setSettings({ ...settings, email: { ...settings.email, enabled } })}
            />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>SMTP host</Label>
              <Input
                className="mt-1.5"
                placeholder="smtp.gmail.com"
                value={settings.email.host}
                onChange={(e) => setSettings({ ...settings, email: { ...settings.email, host: e.target.value } })}
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={settings.email.port}
                onChange={(e) =>
                  setSettings({ ...settings, email: { ...settings.email, port: Number(e.target.value) || 587 } })
                }
              />
            </div>
            <div>
              <Label>From address</Label>
              <Input
                className="mt-1.5"
                placeholder={profileEmail || "you@gmail.com"}
                value={settings.email.from}
                onChange={(e) => setSettings({ ...settings, email: { ...settings.email, from: e.target.value } })}
              />
            </div>
            <div>
              <Label>Username</Label>
              <Input
                className="mt-1.5"
                value={settings.email.user}
                onChange={(e) => setSettings({ ...settings, email: { ...settings.email, user: e.target.value } })}
              />
            </div>
            <div>
              <Label>Password / app password</Label>
              <Input
                className="mt-1.5"
                type="password"
                autoComplete="new-password"
                value={settings.email.pass}
                onChange={(e) => {
                  setEmailPassDirty(true);
                  setSettings({ ...settings, email: { ...settings.email, pass: e.target.value } });
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[hsl(var(--muted-foreground))]">
            Gmail: Google Account → Security → 2-Step Verification → App passwords. Host{" "}
            <code>smtp.gmail.com</code>, port <code>587</code>.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => void persist(settings)}
            disabled={busy}
          >
            Save email
          </Button>
        </section>

        {/* Share */}
        <section className="surface mt-6 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Share anywhere</h2>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            WhatsApp opens a free share link. Slack uses an Incoming Webhook. Copy link works everywhere else.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label>WhatsApp phone (optional, E.164 without +)</Label>
              <Input
                className="mt-1.5"
                placeholder="15551234567"
                value={settings.share.whatsapp.phone}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    share: {
                      ...settings.share,
                      whatsapp: { ...settings.share.whatsapp, phone: e.target.value, enabled: true },
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Slack incoming webhook URL</Label>
              <Input
                className="mt-1.5"
                placeholder="https://hooks.slack.com/services/…"
                value={settings.share.slack.webhookUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    share: {
                      ...settings.share,
                      slack: { enabled: Boolean(e.target.value), webhookUrl: e.target.value },
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void share("whatsapp")} disabled={busy}>
              WhatsApp
            </Button>
            <Button type="button" variant="secondary" onClick={() => void share("slack")} disabled={busy}>
              Slack
            </Button>
            <Button type="button" variant="secondary" onClick={() => void share("email")} disabled={busy}>
              Email draft
            </Button>
            <Button type="button" variant="secondary" onClick={() => void share("link")} disabled={busy}>
              Copy link
            </Button>
            <Button type="button" onClick={() => void persist(settings)} disabled={busy}>
              Save share
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
