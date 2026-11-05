import { NextResponse } from "next/server";
import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEdition } from "@/lib/news";

const schema = z.object({
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
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const edition = await buildEdition(input);
    const dir = path.join(process.cwd(), ".quietpress", "print-queue");
    await mkdir(dir, { recursive: true });

    const filename = `${edition.id}-${Date.now()}.json`;
    const filepath = path.join(dir, filename);
    await writeFile(
      filepath,
      JSON.stringify(
        {
          queuedAt: new Date().toISOString(),
          printTime: input.printTime,
          colorMode: input.colorMode,
          edition,
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
      hint: "Run `npm run print-agent` on the machine connected to your printer.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Print queue failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
