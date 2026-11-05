import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEdition } from "@/lib/news";
import { sendMorningEmail } from "@/lib/email";

const schema = z.object({
  kind: z.enum(["personal", "company"]).default("personal"),
  email: z.string().email(),
  name: z.string().min(1),
  titleStyle: z.enum([
    "the-times",
    "daily-news",
    "the-herald",
    "morning-edition",
    "the-post",
    "custom",
  ]),
  customTitle: z.string().optional(),
  interests: z.array(z.string()).default([]),
  colorMode: z.enum(["bw", "color"]).default("bw"),
  pageCount: z.union([z.literal("auto"), z.number().int().min(1).max(12)]).default("auto"),
  company: z
    .object({
      companyName: z.string(),
      industry: z.string().optional(),
      keywords: z.array(z.string()).default([]),
      competitors: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const profile = schema.parse(await request.json());
    const edition = await buildEdition(profile);
    const result = await sendMorningEmail(profile.email, edition);
    return NextResponse.json({ ok: true, result, editionId: edition.id, articleCount: edition.articles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
