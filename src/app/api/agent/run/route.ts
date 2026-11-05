import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { z } from "zod";

const schema = z.object({
  mode: z.enum(["once", "status"]).default("once"),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => ({ mode: "once" })));
    if (body.mode === "status") {
      return NextResponse.json(await readStatus());
    }

    const { stdout, stderr, code } = await run(["agents/morning_daemon.py", "--once"]);
    return NextResponse.json({
      ok: code === 0,
      code,
      stdout: stdout.slice(-6000),
      stderr: stderr.slice(-2000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json(await readStatus());
}

async function readStatus() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.join(process.cwd(), ".ai-times");
  const files = {
    morning: path.join(root, "morning-daemon-state.json"),
    print: path.join(root, "print-daemon-state.json"),
    news: path.join(root, "agent-state.json"),
    printers: path.join(root, "printers.json"),
  };
  const out: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(files)) {
    try {
      out[key] = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      out[key] = null;
    }
  }
  return { ok: true, ...out, checkedAt: new Date().toISOString() };
}

function run(args: string[]) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const child = spawn("python3", args, { cwd: process.cwd(), env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}
