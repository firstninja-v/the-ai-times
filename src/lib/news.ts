import Parser from "rss-parser";
import { keywordsForInterests } from "./interests";
import type { ColorMode, EditionPage, NewsArticle, NewspaperEdition, UserProfile } from "./types";
import { resolvePaperTitle } from "./paper-titles";

const FEEDS: { category: string; url: string }[] = [
  { category: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { category: "technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { category: "science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { category: "health", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
  { category: "politics", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml" },
  { category: "sports", url: "https://www.espn.com/espn/rss/news" },
  { category: "culture", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
];

const SLOP = [
  /sponsored/i,
  /advertorial/i,
  /\bad\b/i,
  /gift guide/i,
  /what to buy/i,
  /shop now/i,
  /celebrity diet/i,
  /you won't believe/i,
  /click here/i,
];

const BREAKING = [/\bbreaking\b/i, /\burgent\b/i, /\bjust in\b/i, /\balert\b/i];

const FALLBACK: NewsArticle[] = [
  {
    id: "fb-1",
    title: "Markets open steady as central banks hold rates",
    summary:
      "Investors weighed soft inflation prints against resilient labor data. Bond yields eased slightly while major indices opened near flat.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "business",
  },
  {
    id: "fb-2",
    title: "Chipmakers race to secure advanced packaging capacity",
    summary:
      "Foundries and OSAT partners expanded high-density interconnect lines as AI accelerators outpaced traditional packaging supply.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "technology",
  },
  {
    id: "fb-3",
    title: "Climate talks push for clearer carbon-market rules",
    summary:
      "Negotiators circulated a draft clarifying verification standards for cross-border credit trades ahead of the next plenary.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "climate",
    breaking: true,
  },
  {
    id: "fb-4",
    title: "Public-health agencies update seasonal guidance",
    summary:
      "Updated immunization timing and wastewater surveillance notes were released for clinics preparing for winter respiratory season.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "health",
  },
  {
    id: "fb-5",
    title: "City councils revisit late-night transit funding",
    summary:
      "A regional working group proposed extending weekend rail service after ridership recovered past pre-pandemic Friday peaks.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "local",
  },
  {
    id: "fb-6",
    title: "Researchers map a cleaner path for grid-scale storage",
    summary:
      "A peer-reviewed study outlined lower-cobalt chemistries that keep cycle life competitive for multi-hour storage deployments.",
    source: "Quietpress Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "science",
  },
];

function isSlop(title: string, summary: string) {
  const text = `${title} ${summary}`;
  return SLOP.some((re) => re.test(text));
}

function scoreArticle(article: NewsArticle, keywords: string[], interests: string[]) {
  const text = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
  let score = 0;
  if (interests.includes(article.category)) score += 4;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) score += 2;
  }
  if (article.breaking) score += 3;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  score += Math.max(0, 3 - ageHours / 8);
  return score;
}

async function fetchFeed(category: string, url: string): Promise<NewsArticle[]> {
  const parser = new Parser({ timeout: 8000 });
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).slice(0, 12).map((item, index) => {
    const title = item.title?.trim() || "Untitled";
    const summary = (item.contentSnippet || item.content || item.summary || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
    return {
      id: `${category}-${index}-${Buffer.from(title).toString("base64url").slice(0, 12)}`,
      title,
      summary: summary || "No summary provided by the source.",
      source: feed.title || category,
      url: item.link || "#",
      publishedAt: new Date(publishedAt).toISOString(),
      category,
      breaking: BREAKING.some((re) => re.test(title)),
      imageUrl: item.enclosure?.url,
    } satisfies NewsArticle;
  });
}

export async function gatherArticles(interests: string[]): Promise<NewsArticle[]> {
  const selectedFeeds =
    interests.length === 0
      ? FEEDS
      : FEEDS.filter((f) => interests.includes(f.category) || interests.includes("world"));

  const settled = await Promise.allSettled(
    selectedFeeds.map((feed) => fetchFeed(feed.category, feed.url)),
  );

  const live = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const pool = live.length > 0 ? live : FALLBACK;
  const keywords = keywordsForInterests(interests);

  return pool
    .filter((article) => !isSlop(article.title, article.summary))
    .map((article) => ({ article, score: scoreArticle(article, keywords, interests) }))
    .filter(({ score }) => score > 0 || interests.length === 0)
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article);
}

function paginate(articles: NewsArticle[], pageCount: "auto" | number): EditionPage[] {
  const target =
    pageCount === "auto" ? Math.min(6, Math.max(2, Math.ceil(articles.length / 4))) : Number(pageCount);

  const perPage = Math.max(1, Math.ceil(articles.length / target));
  const pages: EditionPage[] = [];

  for (let i = 0; i < target; i++) {
    const slice = articles.slice(i * perPage, (i + 1) * perPage);
    if (slice.length === 0) break;
    const [lead, ...rest] = slice;
    pages.push({
      number: i + 1,
      sections: [
        { layout: "lead", articles: [lead] },
        ...(rest.length
          ? [
              {
                heading: i === 0 ? "Also today" : undefined,
                layout: "column" as const,
                articles: rest,
              },
            ]
          : []),
      ],
    });
  }

  return pages;
}

export async function buildEdition(
  profile: Pick<UserProfile, "name" | "titleStyle" | "customTitle" | "interests" | "colorMode" | "pageCount">,
): Promise<NewspaperEdition> {
  const articles = await gatherArticles(profile.interests);
  const limited = articles.slice(0, profile.pageCount === "auto" ? 18 : Number(profile.pageCount) * 4);
  const now = new Date();

  return {
    id: `edition-${now.toISOString().slice(0, 10)}`,
    paperTitle: resolvePaperTitle(profile),
    dateLabel: now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    generatedAt: now.toISOString(),
    colorMode: profile.colorMode as ColorMode,
    pages: paginate(limited, profile.pageCount),
    articles: limited,
  };
}

export function findBreaking(articles: NewsArticle[], alreadySent: string[]) {
  return articles.filter((a) => a.breaking && !alreadySent.includes(a.id));
}
