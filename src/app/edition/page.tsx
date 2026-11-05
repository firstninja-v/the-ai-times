"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditionView } from "@/components/newspaper/edition-view";
import { DeliveryScheduler } from "@/components/delivery-scheduler";
import { loadProfile } from "@/lib/storage";
import type { NewspaperEdition, UserProfile } from "@/lib/types";

const SAMPLE_PROFILE: UserProfile = {
  name: "Reader",
  email: "reader@ai-times.local",
  titleStyle: "the-times",
  interests: ["technology", "world", "business", "science"],
  colorMode: "bw",
  emailTime: "07:00",
  printEnabled: true,
  printTime: "07:05",
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
    const res = await fetch("/api/email/morning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    setStatus(
      res.ok
        ? data.result?.mode === "mock"
          ? "Email mocked to server logs (configure SMTP to send for real)."
          : "Morning edition emailed."
        : data.error || "Email failed",
    );
  }

  async function queuePrint() {
    if (!profile) return;
    setStatus("Queuing print job…");
    const res = await fetch("/api/print/job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Print job queued (${data.pages} pages). Run npm run print-agent.`);
      window.print();
    } else {
      setStatus(data.error || "Print queue failed");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      {profile ? (
        <DeliveryScheduler profile={profile} onMorningPrint={() => window.print()} />
      ) : null}

      <div className="no-print mx-auto mb-8 flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            The AI Times
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile ? `${profile.name} · ${profile.interests.length} interests` : "Loading profile…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-sm">
            <Link href="/setup">Edit setup</Link>
          </Button>
          <Button variant="outline" className="rounded-sm" onClick={() => profile && refresh(profile)} disabled={loading}>
            Refresh
          </Button>
          <Button variant="outline" className="rounded-sm" onClick={sendEmailNow}>
            Email now
          </Button>
          <Button className="rounded-sm" onClick={queuePrint}>
            Print
          </Button>
        </div>
      </div>

      {status ? (
        <p className="no-print mx-auto mb-6 max-w-5xl text-sm text-muted-foreground">{status}</p>
      ) : null}

      {loading ? (
        <div className="mx-auto max-w-5xl animate-pulse paper-sheet px-8 py-16">
          <div className="mx-auto h-10 w-64 bg-ink/10" />
          <div className="mx-auto mt-6 h-px w-full bg-ink/20" />
          <div className="mt-10 space-y-3">
            <div className="h-4 w-3/4 bg-ink/10" />
            <div className="h-4 w-full bg-ink/10" />
            <div className="h-4 w-5/6 bg-ink/10" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto max-w-5xl rounded-sm border border-destructive/30 bg-white px-6 py-8">
          <h2 className="font-display text-2xl font-semibold">Edition unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-6 rounded-sm" onClick={() => profile && refresh(profile)}>
            Try again
          </Button>
        </div>
      ) : null}

      {edition && !loading ? <EditionView edition={edition} /> : null}
    </main>
  );
}
