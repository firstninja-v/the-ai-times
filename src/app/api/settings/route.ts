import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const settingsPath = () => path.join(process.cwd(), ".ai-times", "settings.json");

const schema = z.object({
  email: z
    .object({
      enabled: z.boolean(),
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      user: z.string(),
      pass: z.string(),
      from: z.string(),
      secure: z.boolean(),
    })
    .optional(),
  share: z
    .object({
      slack: z.object({ enabled: z.boolean(), webhookUrl: z.string() }),
      whatsapp: z.object({ enabled: z.boolean(), phone: z.string() }),
      copyLink: z.boolean(),
    })
    .optional(),
  agents: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        emailTime: z.string(),
        printTime: z.string(),
        printEnabled: z.boolean(),
        printerId: z.string().optional(),
        timezone: z.string(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  updatedAt: z.string().optional(),
});

async function readSettings() {
  try {
    const raw = await readFile(settingsPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      email: {
        enabled: false,
        host: "smtp.gmail.com",
        port: 587,
        user: "",
        pass: "",
        from: "",
        secure: false,
      },
      share: {
        slack: { enabled: false, webhookUrl: "" },
        whatsapp: { enabled: false, phone: "" },
        copyLink: true,
      },
      agents: [],
    };
  }
}

export async function GET() {
  const data = await readSettings();
  // Never echo password to casual clients in full — mask if present
  if (data?.email?.pass) {
    data.email = { ...data.email, pass: data.email.pass ? "••••••••" : "" };
    data.emailHasPass = true;
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const incoming = schema.parse(await request.json());
    const prev = await readSettings();
    const next = {
      ...prev,
      ...incoming,
      email: {
        ...(prev.email || {}),
        ...(incoming.email || {}),
      },
      share: {
        ...(prev.share || {}),
        ...(incoming.share || {}),
      },
      agents: incoming.agents ?? prev.agents ?? [],
      updatedAt: new Date().toISOString(),
    };

    // Keep previous password if client sent masked value
    if (incoming.email?.pass === "••••••••" && prev.email?.pass) {
      next.email.pass = prev.email.pass;
    }

    await mkdir(path.dirname(settingsPath()), { recursive: true });
    await writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf8");

    // Mirror SMTP into env file the Python agents already read
    if (next.email?.enabled && next.email.host && next.email.user && next.email.pass) {
      const envPath = path.join(process.cwd(), "agents", ".env");
      const lines = [
        `SMTP_HOST=${next.email.host}`,
        `SMTP_PORT=${next.email.port}`,
        `SMTP_USER=${next.email.user}`,
        `SMTP_PASS=${next.email.pass}`,
        `SMTP_FROM=${next.email.from || next.email.user}`,
        `SMTP_SECURE=${next.email.secure ? "true" : "false"}`,
      ];
      await writeFile(envPath, lines.join("\n") + "\n", "utf8");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings save failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
