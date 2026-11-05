import { NextResponse } from "next/server";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sendBreakingEmail } from "@/lib/email";

const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  category: z.string(),
  breaking: z.boolean().optional(),
  score: z.number().optional(),
  providerId: z.string().optional(),
  tier: z.string().optional(),
});

const bodySchema = z.object({
  articles: z.array(articleSchema).min(1),
  source: z.string().default("news_agent"),
  collectedAt: z.string().optional(),
  notifyBreaking: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const dir = path.join(process.cwd(), ".ai-times", "inbox");
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `api-${stamp}.json`);
    await writeFile(file, JSON.stringify(body, null, 2), "utf8");

    const breaking = body.articles.filter((a) => a.breaking);
    let notified = 0;

    if (breaking.length > 0) {
      const profilePath = path.join(process.cwd(), ".ai-times", "personal-profile.json");
      try {
        const profile = JSON.parse(await readFile(profilePath, "utf8")) as {
          email?: string;
          name?: string;
          titleStyle?: string;
          customTitle?: string;
          company?: { companyName?: string };
        };
        if (profile.email) {
          const title =
            profile.customTitle ||
            (profile.company?.companyName
              ? `The ${profile.company.companyName} Times`
              : `${profile.name || "Reader"} Times`);
          await sendBreakingEmail(profile.email, title, breaking);
          notified = breaking.length;
        }
      } catch {
        // no saved profile yet
      }
    }

    return NextResponse.json({
      ok: true,
      saved: file,
      count: body.articles.length,
      breaking: breaking.length,
      notified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
