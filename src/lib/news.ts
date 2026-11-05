import Parser from "rss-parser";
import { keywordsForInterests } from "./interests";
import { readInboxArticles } from "./inbox";
import type {
  ColorMode,
  CompanyInfo,
  EditionPage,
  NewsArticle,
  NewspaperEdition,
  UserProfile,
} from "./types";
import { resolvePaperTitle } from "./paper-titles";

const FEEDS: { category: string; url: string; name: string }[] = [
  { category: "world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "business", name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { category: "technology", name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { category: "science", name: "BBC Science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { category: "health", name: "BBC Health", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
  { category: "politics", name: "NYT Politics", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml" },
  { category: "sports", name: "ESPN", url: "https://www.espn.com/espn/rss/news" },
  { category: "culture", name: "BBC Culture", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
  {
    category: "business",
    name: "Guardian Business",
    url: "https://www.theguardian.com/uk/business/rss",
  },
  {
    category: "technology",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
  },
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
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "business",
    score: 4,
  },
  {
    id: "fb-2",
    title: "Chipmakers race to secure advanced packaging capacity",
    summary:
      "Foundries and OSAT partners expanded high-density interconnect lines as AI accelerators outpaced traditional packaging supply.",
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "technology",
    score: 5,
  },
  {
    id: "fb-3",
    title: "Climate talks push for clearer carbon-market rules",
    summary:
      "Negotiators circulated a draft clarifying verification standards for cross-border credit trades ahead of the next plenary.",
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "climate",
    breaking: true,
    score: 8,
  },
  {
    id: "fb-4",
    title: "Public-health agencies update seasonal guidance",
    summary:
      "Updated immunization timing and wastewater surveillance notes were released for clinics preparing for winter respiratory season.",
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "health",
    score: 3,
  },
  {
    id: "fb-5",
    title: "City councils revisit late-night transit funding",
    summary:
      "A regional working group proposed extending weekend rail service after ridership recovered past pre-pandemic Friday peaks.",
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "local",
    score: 2,
  },
  {
    id: "fb-6",
    title: "Researchers map a cleaner path for grid-scale storage",
    summary:
      "A peer-reviewed study outlined lower-cobalt chemistries that keep cycle life competitive for multi-hour storage deployments.",
    source: "The AI Times Desk",
    url: "#",
    publishedAt: new Date().toISOString(),
    category: "science",
    score: 4,
  },
];

function isSlop(title: string, summary: string) {
  const text = `${title} ${summary}`;
  return SLOP.some((re) => re.test(text));
}

function companyBoost(article: NewsArticle, company?: CompanyInfo) {
  if (!company) return 0;
  const text = `${article.title} ${article.summary}`.toLowerCase();
  let boost = 0;
  const needles = [
    company.companyName,
    ...(company.keywords || []),
    ...(company.competitors || []),
    company.industry || "",
  ]
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  for (const needle of needles) {
    if (text.includes(needle)) boost += 5;
  }
  return boost;
}

function promptTokens(prompt?: string) {
  if (!prompt) return [] as string[];
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3 && !["want", "with", "from", "that", "this", "have", "news", "only", "skip", "about"].includes(t));
}

function scoreArticle(
  article: NewsArticle,
  keywords: string[],
  interests: string[],
  company?: CompanyInfo,
  newsPrompt?: string,
) {
  const text = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
  let score = article.score ?? 0;
  if (interests.includes(article.category)) score += 4;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) score += 2;
  }
  for (const token of promptTokens(newsPrompt)) {
    if (text.includes(token)) score += 1.5;
  }
  if (newsPrompt && /skip|ignore|no celebrity|no gossip|no shopping/i.test(newsPrompt)) {
    if (/celebrity|gossip|shopping|gift guide/i.test(text)) score -= 6;
  }
  if (article.breaking) score += 3;
  score += companyBoost(article, company);
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  score += Math.max(0, 3 - ageHours / 8);
  return score;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<NewsArticle[]> {
  const parser = new Parser({ timeout: 8000 });
  const parsed = await parser.parseURL(feed.url);
  return (parsed.items ?? []).slice(0, 12).map((item, index) => {
    const title = item.title?.trim() || "Untitled";
    const summary = (item.contentSnippet || item.content || item.summary || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
    return {
      id: `${feed.category}-${index}-${Buffer.from(title).toString("base64url").slice(0, 12)}`,
      title,
      summary: summary || "No summary provided by the source.",
      source: feed.name || parsed.title || feed.category,
      url: item.link || "#",
      publishedAt: new Date(publishedAt).toISOString(),
      category: feed.category,
      breaking: BREAKING.some((re) => re.test(title)),
      imageUrl: item.enclosure?.url,
      tier: "premium",
    } satisfies NewsArticle;
  });
}

export async function gatherArticles(
  interests: string[],
  company?: CompanyInfo,
  newsPrompt?: string,
): Promise<NewsArticle[]> {
  const selectedFeeds =
    interests.length === 0
      ? FEEDS
      : FEEDS.filter((f) => interests.includes(f.category) || interests.includes("world"));

  const settled = await Promise.allSettled(selectedFeeds.map((feed) => fetchFeed(feed)));
  const live = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const inbox = await readInboxArticles(100);
  const pool = [...inbox, ...live];
  const effective = pool.length > 0 ? pool : FALLBACK;
  const keywords = [
    ...keywordsForInterests(interests),
    ...promptTokens(newsPrompt),
    ...(company?.keywords || []),
    company?.companyName || "",
  ].filter(Boolean);

  return effective
    .filter((article) => !isSlop(article.title, article.summary))
    .map((article) => ({
      article,
      score: scoreArticle(article, keywords, interests, company, newsPrompt),
    }))
    .filter(({ score }) => score > 0 || interests.length === 0 || Boolean(newsPrompt))
    .sort((a, b) => b.score - a.score)
    .map(({ article, score }) => ({ ...article, score }));
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
  profile: Pick<
    UserProfile,
    | "name"
    | "titleStyle"
    | "customTitle"
    | "interests"
    | "colorMode"
    | "pageCount"
    | "kind"
    | "company"
    | "newsPrompt"
  >,
): Promise<NewspaperEdition> {
  const articles = await gatherArticles(profile.interests, profile.company, profile.newsPrompt);
  const limited = articles.slice(0, profile.pageCount === "auto" ? 18 : Number(profile.pageCount) * 4);
  const now = new Date();
  const paperTitle =
    profile.kind === "company" && profile.company?.companyName
      ? profile.customTitle?.trim() ||
        `The ${profile.company.companyName} Times`
      : resolvePaperTitle(profile);

  return {
    id: `edition-${now.toISOString().slice(0, 10)}`,
    paperTitle,
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
    kind: profile.kind || "personal",
    companyName: profile.company?.companyName,
  };
}

export function findBreaking(articles: NewsArticle[], alreadySent: string[]) {
  return articles.filter((a) => a.breaking && !alreadySent.includes(a.id));
}
