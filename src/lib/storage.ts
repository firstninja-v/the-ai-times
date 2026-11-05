import type { UserProfile } from "./types";

export const PROFILE_KEY = "quietpress.profile";
export const LAST_EDITION_KEY = "quietpress.lastEditionId";
export const SENT_BREAKING_KEY = "quietpress.sentBreaking";

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
