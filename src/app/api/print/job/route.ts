import { NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEdition } from "@/lib/news";

const schema = z.object({
  kind: z.enum(["personal", "company"]).default("personal"),
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
  printTime: z.string().optional(),
  printerId: z.string().optional(),
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
    const input = schema.parse(await request.json());
    const edition = await buildEdition(input);
    const dir = path.join(process.cwd(), ".ai-times", "print-queue");
    await mkdir(dir, { recursive: true });

    const filename = `${edition.id}-${Date.now()}.json`;
    const filepath = path.join(dir, filename);
    await writeFile(
      filepath,
      JSON.stringify(
        {
          queuedAt: new Date().toISOString(),
          printTime: input.printTime,
          printerId: input.printerId,
          colorMode: input.colorMode,
          edition,
          auto: false,
        },
        null,
        2,
      ),
      "utf8",
    );

    return NextResponse.json({
      ok: true,
      job: filename,
      path: filepath,
      pages: edition.pages.length,
      hint: "Hands-free loop: npm run agent:print · one-shot watcher: npm run print-agent",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Print queue failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
