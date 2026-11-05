"use client";

import { useEffect, useRef } from "react";
import type { UserProfile } from "@/lib/types";
import { isDue, todayKey } from "@/lib/schedule";
import { SENT_BREAKING_KEY } from "@/lib/storage";

export function DeliveryScheduler({
  profile,
  onMorningPrint,
}: {
  profile: UserProfile;
  onMorningPrint?: () => void;
}) {
  const lastEmailDay = useRef<string | null>(null);
  const lastPrintDay = useRef<string | null>(null);

  useEffect(() => {
    const tick = async () => {
      const day = todayKey();

      if (isDue(profile.emailTime) && lastEmailDay.current !== day) {
        lastEmailDay.current = day;
        await fetch("/api/email/morning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
      }

      if (profile.printEnabled && isDue(profile.printTime) && lastPrintDay.current !== day) {
        lastPrintDay.current = day;
        await fetch("/api/print/job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        onMorningPrint?.();
      }

      if (profile.breakingNews) {
        const alreadySent: string[] = JSON.parse(localStorage.getItem(SENT_BREAKING_KEY) || "[]");
        const res = await fetch("/api/email/breaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profile, alreadySent }),
        });
        const data = await res.json();
        if (data.sent && Array.isArray(data.ids)) {
          localStorage.setItem(SENT_BREAKING_KEY, JSON.stringify([...alreadySent, ...data.ids]));
        }
      }
    };

    const id = window.setInterval(tick, 30_000);
    void tick();
    return () => window.clearInterval(id);
  }, [profile, onMorningPrint]);

  return null;
}
