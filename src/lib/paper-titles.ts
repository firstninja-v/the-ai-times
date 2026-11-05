import type { PaperTitleStyle, UserProfile } from "./types";

export const TITLE_OPTIONS: {
  id: PaperTitleStyle;
  label: string;
  example: (name: string) => string;
}[] = [
  {
    id: "the-times",
    label: "The Times",
    example: (name) => `The ${name.trim() || "Reader"} Times`,
  },
  {
    id: "daily-news",
    label: "Daily News",
    example: (name) => `${possessive(name)} Daily News`,
  },
  {
    id: "the-herald",
    label: "The Herald",
    example: (name) => `The ${name.trim() || "Reader"} Herald`,
  },
  {
    id: "morning-edition",
    label: "Morning Edition",
    example: (name) => `${name.trim() || "Reader"} Morning Edition`,
  },
  {
    id: "the-post",
    label: "The Post",
    example: (name) => `The ${name.trim() || "Reader"} Post`,
  },
  {
    id: "custom",
    label: "Custom title",
    example: () => "Your custom masthead",
  },
];

function possessive(name: string) {
  const clean = name.trim() || "Reader";
  return clean.endsWith("s") ? `${clean}'` : `${clean}'s`;
}

export function resolvePaperTitle(profile: Pick<UserProfile, "name" | "titleStyle" | "customTitle">) {
  if (profile.titleStyle === "custom" && profile.customTitle?.trim()) {
    return profile.customTitle.trim();
  }
  const option = TITLE_OPTIONS.find((o) => o.id === profile.titleStyle) ?? TITLE_OPTIONS[0];
  return option.example(profile.name.trim() || "Reader");
}
