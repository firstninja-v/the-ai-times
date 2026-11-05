"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EditionView } from "@/components/newspaper/edition-view";
import { DeliveryScheduler } from "@/components/delivery-scheduler";
import { SiteHeader } from "@/components/site-header";
import { loadProfile } from "@/lib/storage";
import type { NewspaperEdition, UserProfile } from "@/lib/types";

const SAMPLE_PROFILE: UserProfile = {
  kind: "personal",
  name: "Reader",
  email: "reader@theaitimes.local",
  titleStyle: "the-times",
  interests: ["technology", "world", "business", "science"],
  newsPrompt: "Useful morning coverage on AI, markets, and world affairs. Skip celebrity gossip.",
  colorMode: "bw",
  emailTime: "06:00",
  printEnabled: true,
  printTime: "06:05",
  timezone: "America/New_York",
  pageCount: "auto",
  breakingNews: true,
  createdAt: new Date().toISOString(),
};

export default function EditionPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [edition, setEdition] = useState<NewspaperEdition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async (active: UserProfile) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/edition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(active),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not build edition");
      setEdition(data.edition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load edition");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = loadProfile() ?? SAMPLE_PROFILE;
    setProfile(saved);
    void refresh(saved);
  }, [refresh]);

  async function sendEmailNow() {
    if (!profile) return;
    setStatus("Sending morning edition…");
    try {
      const res = await fetch("/api/email/morning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      setStatus(
        res.ok
          ? data.result?.mode === "mock"
            ? "Email mocked to server logs (add SMTP in .env.local to send for real)."
            : "Morning edition emailed."
          : data.error || "Email failed",
      );
    } catch {
      setStatus("Email request failed. Is the server running?");
    }
  }

  async function queuePrint() {
    if (!profile) return;
    setStatus("Queuing print job…");
    try {
      const res = await fetch("/api/print/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Print job queued (${data.pages} pages). Run npm run print-agent.`);
        window.setTimeout(() => window.print(), 150);
      } else {
        setStatus(data.error || "Print queue failed");
      }
    } catch {
      setStatus("Print request failed. Is the server running?");
    }
  }

  return (
    <main className="min-h-screen pb-16">
      {profile ? (
        <DeliveryScheduler profile={profile} onMorningPrint={() => window.print()} />
      ) : null}

      <SiteHeader
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/settings" className="btn-ghost hidden sm:inline-flex">
              Settings
            </Link>
            <Link href="/setup" className="btn-ghost hidden sm:inline-flex">
              Edit setup
            </Link>
            <button
              type="button"
              className="btn-secondary !h-10 !px-4 !text-[13px]"
              onClick={() => profile && refresh(profile)}
              disabled={loading}
            >
              Refresh
            </button>
            <button type="button" className="btn-secondary !h-10 !px-4 !text-[13px]" onClick={sendEmailNow}>
              Email
            </button>
            <button
              type="button"
              className="btn-secondary !h-10 !px-4 !text-[13px]"
              onClick={async () => {
                const res = await fetch("/api/share", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ channel: "whatsapp" }),
                });
                const data = await res.json();
                if (data.url) window.open(data.url, "_blank");
              }}
            >
              Share
            </button>
            <button type="button" className="btn-primary !h-10 !px-5 !text-[13px]" onClick={queuePrint}>
              Print
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-8">
        <div className="no-print mb-8">
          <p className="text-[13px] font-medium text-[hsl(var(--muted-foreground))]">
            {profile
              ? `${profile.name} · ${profile.interests.length} interests · ${edition?.paperTitle ?? "Preparing…"}`
              : "Loading profile…"}
          </p>
          {status ? <p className="mt-2 text-[13px] text-[hsl(var(--apple-blue))]">{status}</p> : null}
        </div>

        {loading ? (
          <div className="paper-sheet animate-pulse rounded-[4px] px-8 py-16">
            <div className="mx-auto h-10 w-64 rounded-full bg-black/5" />
            <div className="mx-auto mt-6 h-px w-full bg-black/10" />
            <div className="mt-10 space-y-3">
              <div className="h-4 w-3/4 rounded-full bg-black/5" />
              <div className="h-4 w-full rounded-full bg-black/5" />
              <div className="h-4 w-5/6 rounded-full bg-black/5" />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="surface rounded-3xl px-6 py-8">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Edition unavailable</h2>
            <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">{error}</p>
            <button
              type="button"
              className="btn-primary mt-6"
              onClick={() => profile && refresh(profile)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {edition && !loading ? <EditionView edition={edition} /> : null}
      </div>
    </main>
  );
}
