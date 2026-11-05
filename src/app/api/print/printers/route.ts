import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const settingsSchema = z.object({
  paperSize: z.enum(["A4", "Letter", "Tabloid"]).default("A4"),
  colorMode: z.enum(["bw", "color"]).default("bw"),
  duplex: z.boolean().default(false),
  copies: z.number().int().min(1).max(20).default(1),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  autoPrint: z.boolean().default(true),
});

const FALLBACK = {
  printers: [
    {
      id: "ai-times-pdf",
      name: "AI Times PDF (universal fallback)",
      driver: "file",
      isDefault: true,
      settings: {
        paperSize: "A4",
        colorMode: "bw",
        duplex: false,
        copies: 1,
        orientation: "portrait",
        autoPrint: true,
      },
    },
  ],
  hint: "Run Discover to find CUPS/IPP printers, or use PDF fallback + browser Print.",
};

async function readPrinters() {
  const file = path.join(process.cwd(), ".ai-times", "printers.json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return FALLBACK;
  }
}

function discoverOnce(): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn("python3", ["-c", "from agents.print_daemon import sync_printer_registry; sync_printer_registry()"], {
      cwd: process.cwd(),
      env: process.env,
    });
    child.on("close", () => resolve());
    setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve();
    }, 12_000);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("discover") === "1") {
    await discoverOnce();
  }
  return NextResponse.json(await readPrinters());
}

export async function POST(request: Request) {
  try {
    const body = z
      .object({
        printerId: z.string(),
        settings: settingsSchema,
        setDefault: z.boolean().optional(),
      })
      .parse(await request.json());

    const dir = path.join(process.cwd(), ".ai-times");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "printers.json");
    let current = await readPrinters();

    current.printers = (current.printers || []).map((p: Record<string, unknown>) => {
      const match = p.id === body.printerId;
      return {
        ...p,
        settings: match ? body.settings : p.settings,
        isDefault: body.setDefault ? match : p.isDefault,
      };
    });

    if (!current.printers.some((p: { id: string }) => p.id === body.printerId)) {
      current.printers.push({
        id: body.printerId,
        name: body.printerId,
        driver: "file",
        isDefault: Boolean(body.setDefault),
        settings: body.settings,
      });
    }

    if (body.setDefault) {
      current.printers = current.printers.map((p: { id: string; isDefault?: boolean }) => ({
        ...p,
        isDefault: p.id === body.printerId,
      }));
    }

    await writeFile(
      file,
      JSON.stringify({ ...current, updatedAt: new Date().toISOString() }, null, 2),
    );
    return NextResponse.json({ ok: true, printers: current.printers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Printer update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
