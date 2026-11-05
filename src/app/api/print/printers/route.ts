import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const settingsSchema = z.object({
  paperSize: z.enum(["A4", "Letter", "Tabloid"]).default("Letter"),
  colorMode: z.enum(["bw", "color"]).default("bw"),
  duplex: z.boolean().default(false),
  copies: z.number().int().min(1).max(20).default(1),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  autoPrint: z.boolean().default(true),
});

export async function GET() {
  const file = path.join(process.cwd(), ".ai-times", "printers.json");
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      printers: [
        {
          id: "ai-times-pdf",
          name: "AI Times PDF (universal fallback)",
          driver: "file",
          isDefault: true,
          settings: {
            paperSize: "Letter",
            colorMode: "bw",
            duplex: false,
            copies: 1,
            orientation: "portrait",
            autoPrint: true,
          },
        },
      ],
      hint: "Run npm run agent:print to discover CUPS/IPP printers in a loop.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = z
      .object({
        printerId: z.string(),
        settings: settingsSchema,
      })
      .parse(await request.json());

    const dir = path.join(process.cwd(), ".ai-times");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "printers.json");
    let current: { printers: Array<Record<string, unknown>> } = { printers: [] };
    try {
      current = JSON.parse(await readFile(file, "utf8"));
    } catch {
      current = { printers: [] };
    }

    current.printers = (current.printers || []).map((p) =>
      p.id === body.printerId ? { ...p, settings: body.settings } : p,
    );

    if (!current.printers.some((p) => p.id === body.printerId)) {
      current.printers.push({
        id: body.printerId,
        name: body.printerId,
        driver: "file",
        settings: body.settings,
      });
    }

    await writeFile(file, JSON.stringify({ ...current, updatedAt: new Date().toISOString() }, null, 2));
    return NextResponse.json({ ok: true, printers: current.printers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Printer update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
