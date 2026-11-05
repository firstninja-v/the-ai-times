import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { NewsArticle } from "./types";

const INBOX = path.join(process.cwd(), ".ai-times", "inbox");

export async function readInboxArticles(limit = 80): Promise<NewsArticle[]> {
  try {
    const files = (await readdir(INBOX))
      .filter((f) => f.startsWith("batch-") && f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 3);

    const articles: NewsArticle[] = [];
    for (const file of files) {
      const raw = await readFile(path.join(INBOX, file), "utf8");
      const data = JSON.parse(raw) as { articles?: NewsArticle[] };
      for (const article of data.articles ?? []) {
        articles.push({
          ...article,
          publishedAt: safeDate(article.publishedAt),
        });
      }
    }

    const byId = new Map<string, NewsArticle>();
    for (const article of articles) {
      const prev = byId.get(article.id);
      if (!prev || (article.score ?? 0) > (prev.score ?? 0)) {
        byId.set(article.id, article);
      }
    }
    return [...byId.values()]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function safeDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
