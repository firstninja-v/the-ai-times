import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const deliveryPath = () => path.join(process.cwd(), ".ai-times", "delivery.json");
const printersPath = () => path.join(process.cwd(), ".ai-times", "printers.json");
const settingsPath = () => path.join(process.cwd(), ".ai-times", "settings.json");

const DEFAULT = {
  paused: false,
  pauseMode: "print" as const,
  printerId: null as string | null,
  printerName: null as string | null,
  printerConnectedAt: null as string | null,
};

async function readDelivery() {
  try {
    return { ...DEFAULT, ...JSON.parse(await readFile(deliveryPath(), "utf8")) };
  } catch {
    return { ...DEFAULT };
  }
}

async function writeDelivery(data: Record<string, unknown>) {
  await mkdir(path.dirname(deliveryPath()), { recursive: true });
  const next = { ...data, updatedAt: new Date().toISOString() };
  await writeFile(deliveryPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

async function readPrinters() {
  try {
    return JSON.parse(await readFile(printersPath(), "utf8"));
  } catch {
    return { printers: [] };
  }
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({
    action: z.literal("pause"),
    pauseMode: z.enum(["print", "all"]).optional(),
  }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("discover_wifi") }),
  z.object({
    action: z.literal("connect_printer"),
    printerId: z.string().min(1),
    printerName: z.string().optional(),
  }),
  z.object({
    action: z.literal("add_ipp"),
    name: z.string().min(1),
    uri: z.string().min(8),
    setDefault: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("test_print"),
    printerId: z.string().optional(),
  }),
]);

function runPython(code: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const { spawn } = require("node:child_process") as typeof import("node:child_process");
    const child = spawn("python3", ["-c", code], { cwd: process.cwd(), env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (c) => resolve({ code: c ?? 1, stdout, stderr }));
  });
}

export async function GET() {
  const delivery = await readDelivery();
  const printers = await readPrinters();
  return NextResponse.json({
    ok: true,
    delivery,
    printers: printers.printers || [],
    howPrintWorks: [
      "Connect your home or office Wi‑Fi printer once (Scan Wi‑Fi, or paste an IPP address).",
      "We register it with CUPS and remember that printer for every morning job.",
      "At print time the agent converts today’s A4 paper to PDF and sends it over Wi‑Fi/IPP — no click.",
      "If you’re away, hit Pause printing. Email can still arrive; the printer stays quiet until Resume.",
      "PDF fallback is only for testing when no hardware printer is available yet.",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const delivery = await readDelivery();

    if (body.action === "status") {
      return GET();
    }

    if (body.action === "pause") {
      const next = await writeDelivery({
        ...delivery,
        paused: true,
        pauseMode: body.pauseMode || delivery.pauseMode || "print",
      });
      return NextResponse.json({
        ok: true,
        delivery: next,
        message:
          (body.pauseMode || "print") === "all"
            ? "Paused: no generate / email / print until you hit Play."
            : "Paused printing: mornings can still email; your home printer will not run until Resume.",
      });
    }

    if (body.action === "resume") {
      const next = await writeDelivery({ ...delivery, paused: false });
      return NextResponse.json({
        ok: true,
        delivery: next,
        message: "Resumed. Everyday print is armed again for your connected printer.",
      });
    }

    if (body.action === "connect_printer") {
      const printersDoc = await readPrinters();
      const list = printersDoc.printers || [];
      const match = list.find((p: { id: string }) => p.id === body.printerId);
      const name = body.printerName || match?.name || body.printerId;

      // Mark default in registry
      const updated = list.map((p: Record<string, unknown>) => ({
        ...p,
        isDefault: p.id === body.printerId,
        connected: p.id === body.printerId,
      }));
      if (!updated.some((p: { id: string }) => p.id === body.printerId)) {
        updated.push({
          id: body.printerId,
          name,
          driver: "file",
          isDefault: true,
          connected: true,
          settings: {
            paperSize: "A4",
            colorMode: "bw",
            duplex: false,
            copies: 1,
            orientation: "portrait",
            autoPrint: true,
          },
        });
      }
      await mkdir(path.dirname(printersPath()), { recursive: true });
      await writeFile(
        printersPath(),
        JSON.stringify(
          { ...printersDoc, printers: updated, updatedAt: new Date().toISOString() },
          null,
          2,
        ),
        "utf8",
      );

      // Mirror onto delivery agents + profiles
      try {
        const settings = JSON.parse(await readFile(settingsPath(), "utf8"));
        settings.agents = (settings.agents || []).map((a: Record<string, unknown>) => ({
          ...a,
          printerId: body.printerId,
          printEnabled: true,
        }));
        await writeFile(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
      } catch {
        /* no settings yet */
      }

      const next = await writeDelivery({
        ...delivery,
        printerId: body.printerId,
        printerName: name,
        printerConnectedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        delivery: next,
        printers: updated,
        message: `Connected “${name}”. Everyday print will use this printer until you change it.`,
      });
    }

    if (body.action === "discover_wifi") {
      const py = await runPython(
        "import json; from agents.newspaper.wifi_print import discover_wifi_printers; print(json.dumps(discover_wifi_printers(timeout=3.5)))",
      );
      let wifi: Array<Record<string, unknown>> = [];
      try {
        wifi = JSON.parse(py.stdout.trim().split("\n").at(-1) || "[]");
      } catch {
        wifi = [];
      }
      const printersDoc = await readPrinters();
      const byId = new Map<string, Record<string, unknown>>();
      for (const p of printersDoc.printers || []) byId.set(p.id, p);
      for (const w of wifi) {
        const prev = byId.get(String(w.id)) || {};
        byId.set(String(w.id), {
          ...prev,
          ...w,
          settings: prev.settings || {
            paperSize: "A4",
            colorMode: "bw",
            duplex: false,
            copies: 1,
            orientation: "portrait",
            autoPrint: true,
          },
        });
      }
      if (![...byId.keys()].includes("ai-times-pdf")) {
        byId.set("ai-times-pdf", {
          id: "ai-times-pdf",
          name: "AI Times PDF (universal fallback)",
          driver: "file",
          transport: "file",
          isDefault: byId.size === 0,
          status: "ready",
          settings: {
            paperSize: "A4",
            colorMode: "bw",
            duplex: false,
            copies: 1,
            orientation: "portrait",
            autoPrint: true,
          },
        });
      }
      const printers = [...byId.values()];
      await mkdir(path.dirname(printersPath()), { recursive: true });
      await writeFile(
        printersPath(),
        JSON.stringify({ printers, updatedAt: new Date().toISOString(), count: printers.length }, null, 2),
        "utf8",
      );
      return NextResponse.json({
        ok: true,
        printers,
        wifiCount: wifi.length,
        message:
          wifi.length > 0
            ? `Found ${wifi.length} Wi‑Fi / AirPrint printer(s) on your network. Select one and Connect.`
            : "No Wi‑Fi printers answered on the LAN. Add your printer’s IPP address manually (often on the sticker or router page).",
        stderr: py.stderr.slice(-500),
      });
    }

    if (body.action === "add_ipp") {
      const reg = await runPython(
        `import json
from agents.newspaper.wifi_print import register_cups_ipp, normalize_ipp_uri, probe_ipp
uri = normalize_ipp_uri(${JSON.stringify(body.uri)})
probe = probe_ipp(uri)
reg = register_cups_ipp(${JSON.stringify(body.name)}, uri)
print(json.dumps({"probe": probe, "reg": reg, "uri": uri}))
`,
      );
      let info: {
        probe?: { ok?: boolean; error?: string; uri?: string };
        reg?: Record<string, unknown>;
        uri?: string;
      } = {};
      try {
        info = JSON.parse(reg.stdout.trim().split("\n").at(-1) || "{}");
      } catch {
        info = {};
      }

      const printersDoc = await readPrinters();
      const list = printersDoc.printers || [];
      const id = String(info.reg?.id || body.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "wifi-printer");
      const entry = {
        id,
        name: body.name,
        driver: "ipp",
        transport: "wifi",
        uri: info.uri || body.uri,
        cupsQueue: info.reg?.cupsQueue || id,
        isDefault: Boolean(body.setDefault),
        connected: Boolean(body.setDefault),
        supportsColor: true,
        paperSizes: ["A4", "Letter", "Tabloid"],
        duplex: true,
        status: info.reg?.ok ? "ready" : info.probe?.ok ? "reachable" : "configured",
        probe: info.probe,
        settings: {
          paperSize: "A4",
          colorMode: "bw",
          duplex: false,
          copies: 1,
          orientation: "portrait",
          autoPrint: true,
        },
      };
      const without = list.filter((p: { id: string }) => p.id !== id);
      const printers = body.setDefault
        ? [...without.map((p: Record<string, unknown>) => ({ ...p, isDefault: false, connected: false })), { ...entry, isDefault: true }]
        : [...without, entry];
      await mkdir(path.dirname(printersPath()), { recursive: true });
      await writeFile(
        printersPath(),
        JSON.stringify({ printers, updatedAt: new Date().toISOString(), count: printers.length }, null, 2),
        "utf8",
      );

      let deliveryNext = delivery;
      if (body.setDefault) {
        deliveryNext = await writeDelivery({
          ...delivery,
          printerId: id,
          printerName: body.name,
          printerConnectedAt: new Date().toISOString(),
        });
      }

      const reach = info.probe?.ok ? "reachable on Wi‑Fi" : `not reachable yet (${info.probe?.error || "check IP/VPN"})`;
      const cups = info.reg?.ok ? "registered with CUPS" : `CUPS note: ${info.reg?.error || "saved URI only"}`;
      return NextResponse.json({
        ok: true,
        printer: entry,
        printers,
        delivery: deliveryNext,
        message: `Wi‑Fi printer “${body.name}” saved (${reach}; ${cups}).${
          body.setDefault ? " Set as everyday printer." : ""
        }`,
      });
    }

    if (body.action === "test_print") {
      const printerId = body.printerId || delivery.printerId || "ai-times-pdf";
      const { spawn } = await import("node:child_process");
      // Use morning print path via a tiny python one-liner / existing once with print
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(
          "python3",
          [
            "-c",
            `
from pathlib import Path
import json, sys
sys.path.insert(0, '.')
from agents.morning_daemon import print_latest, load_json
from agents.newspaper.config import DATA
profile = {'name':'Test','printerId': ${JSON.stringify(printerId)}, 'colorMode':'bw', 'printEnabled': True}
# Prefer latest public edition
result = {'html': str(Path('public/editions/latest.html'))}
print(json.dumps(print_latest(profile, result, force=True)))
`,
          ],
          { cwd: process.cwd(), env: process.env },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        child.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
      });

      let printed = null;
      try {
        printed = JSON.parse(result.stdout.trim().split("\n").at(-1) || "null");
      } catch {
        printed = { raw: result.stdout.slice(-500) };
      }

      return NextResponse.json({
        ok: result.code === 0,
        printed,
        message:
          printed?.mode === "cups"
            ? `Test sent to printer “${printed.printer}” via CUPS.`
            : printed?.mode === "ipp"
              ? `Test queued to IPP printer “${printed.printer}”.`
              : `Test wrote print file (${printed?.file || "print-output"}). Connect a real CUPS/IPP printer for hardware output.`,
        stderr: result.stderr.slice(-800),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
