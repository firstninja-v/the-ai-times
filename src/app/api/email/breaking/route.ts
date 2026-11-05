import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEdition, findBreaking } from "@/lib/news";
import { sendBreakingEmail } from "@/lib/email";
import { resolvePaperTitle } from "@/lib/paper-titles";

const schema = z.object({
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
  alreadySent: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const edition = await buildEdition(input);
    const breaking = findBreaking(edition.articles, input.alreadySent);

    if (breaking.length === 0) {
      return NextResponse.json({ ok: true, sent: false, breaking: [] });
    }

    const paperTitle = resolvePaperTitle(input);
    const result = await sendBreakingEmail(input.email, paperTitle, breaking);
    return NextResponse.json({
      ok: true,
      sent: true,
      breaking,
      result,
      ids: breaking.map((b) => b.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Breaking check failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
