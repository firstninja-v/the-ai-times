import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEdition } from "@/lib/news";

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
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
  colorMode: z.enum(["bw", "color"]),
  pageCount: z.union([z.literal("auto"), z.number().int().min(1).max(12)]).default("auto"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const profile = bodySchema.parse(json);
    const edition = await buildEdition(profile);
    return NextResponse.json({ edition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build edition";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
