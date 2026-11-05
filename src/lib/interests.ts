export const INTEREST_CATALOG = [
  { id: "world", label: "World", keywords: ["world", "geopolitics", "united nations", "diplomacy"] },
  { id: "politics", label: "Politics", keywords: ["politics", "election", "congress", "parliament", "policy"] },
  { id: "business", label: "Business", keywords: ["business", "markets", "economy", "finance", "stocks"] },
  { id: "technology", label: "Technology", keywords: ["technology", "software", "ai", "startup", "chip"] },
  { id: "science", label: "Science", keywords: ["science", "research", "space", "climate", "biology"] },
  { id: "health", label: "Health", keywords: ["health", "medicine", "hospital", "disease", "vaccine"] },
  { id: "climate", label: "Climate", keywords: ["climate", "emissions", "renewable", "weather", "energy"] },
  { id: "culture", label: "Culture", keywords: ["culture", "arts", "film", "music", "books"] },
  { id: "sports", label: "Sports", keywords: ["sports", "football", "soccer", "olympics", "tennis"] },
  { id: "local", label: "Local / civic", keywords: ["city", "mayor", "community", "school", "transit"] },
] as const;

export type InterestId = (typeof INTEREST_CATALOG)[number]["id"];

export function keywordsForInterests(interestIds: string[]): string[] {
  const set = new Set<string>();
  for (const interest of INTEREST_CATALOG) {
    if (interestIds.includes(interest.id)) {
      interest.keywords.forEach((k) => set.add(k));
    }
  }
  return [...set];
}
