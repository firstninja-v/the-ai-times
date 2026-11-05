export type ContentVolume = "less" | "medium" | "more";

export const CONTENT_VOLUMES: {
  id: ContentVolume;
  label: string;
  description: string;
}[] = [
  {
    id: "less",
    label: "Less",
    description: "Quick skim — fewer stories, shorter copy.",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced morning paper — solid read without the slog.",
  },
  {
    id: "more",
    label: "More",
    description: "Deep desk — more stories, longer bodies, denser pages.",
  },
];
