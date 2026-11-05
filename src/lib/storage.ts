import type { UserProfile } from "./types";

export const PROFILE_KEY = "ai-times.profile";
export const LAST_EDITION_KEY = "ai-times.lastEditionId";
export const SENT_BREAKING_KEY = "ai-times.sentBreaking";

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(LAST_EDITION_KEY);
  localStorage.removeItem(SENT_BREAKING_KEY);
}
