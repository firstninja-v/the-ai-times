import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  channel: z.enum(["slack", "whatsapp", "email", "link"]),
  editionUrl: z.string().default("/editions/latest.html"),
  title: z.string().default("The AI Times"),
  message: z.string().optional(),
});

async function loadSettings() {
  try {
    const raw = await readFile(path.join(process.cwd(), ".ai-times", "settings.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const settings = await loadSettings();
    const origin = new URL(request.url).origin;
    const absolute = body.editionUrl.startsWith("http")
      ? body.editionUrl
      : `${origin}${body.editionUrl}`;
    const text =
      body.message ||
      `${body.title} — today's edition is ready.\n${absolute}`;

    if (body.channel === "link") {
      return NextResponse.json({ ok: true, url: absolute, text });
    }

    if (body.channel === "email") {
      const mailto = `mailto:?subject=${encodeURIComponent(body.title + " — morning edition")}&body=${encodeURIComponent(text)}`;
      return NextResponse.json({ ok: true, url: mailto, text });
    }

    if (body.channel === "whatsapp") {
      const phone = (settings?.share?.whatsapp?.phone || "").replace(/\D/g, "");
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      return NextResponse.json({ ok: true, url, text });
    }

    if (body.channel === "slack") {
      const webhook = settings?.share?.slack?.webhookUrl;
      if (!webhook) {
        return NextResponse.json(
          { error: "Add a Slack incoming webhook in Settings first." },
          { status: 400 },
        );
      }
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*${body.title}*\n${text}` },
            },
          ],
        }),
      });
      if (!res.ok) {
        return NextResponse.json({ error: `Slack webhook failed (${res.status})` }, { status: 502 });
      }
      return NextResponse.json({ ok: true, mode: "slack" });
    }

    return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
