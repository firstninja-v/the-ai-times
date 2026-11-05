import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["personal", "company"]).default("personal"),
  name: z.string().min(1),
  email: z.string().email(),
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
  emailTime: z.string(),
  printEnabled: z.boolean(),
  printTime: z.string(),
  printerId: z.string().optional(),
  timezone: z.string(),
  pageCount: z.union([z.literal("auto"), z.number()]).default("auto"),
  breakingNews: z.boolean(),
  company: z
    .object({
      companyName: z.string(),
      industry: z.string().optional(),
      keywords: z.array(z.string()).default([]),
      competitors: z.array(z.string()).optional(),
      pressUrls: z.array(z.string()).optional(),
      website: z.string().optional(),
    })
    .optional(),
  createdAt: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const profile = schema.parse(await request.json());
    const dir = path.join(process.cwd(), ".ai-times");
    await mkdir(path.join(dir, "profiles"), { recursive: true });
    await writeFile(path.join(dir, "personal-profile.json"), JSON.stringify(profile, null, 2), "utf8");

    const slug = (profile.company?.companyName || profile.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await writeFile(
      path.join(dir, "profiles", `${slug || "reader"}.json`),
      JSON.stringify(profile, null, 2),
      "utf8",
    );

    return NextResponse.json({ ok: true, slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
