import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();
const DATA = path.join(ROOT, ".ai-times");
const PID_DIR = path.join(DATA, "pids");

const AGENTS = {
  morning: {
    script: "agents/morning_daemon.py",
    label: "Morning delivery (generate → email → print every day)",
  },
  news: {
    script: "agents/news_agent.py",
    label: "News desk (wires all day)",
  },
  print: {
    script: "agents/print_daemon.py",
    label: "Print daemon (printer queue)",
  },
} as const;

type AgentKey = keyof typeof AGENTS;

const schema = z.object({
  action: z.enum(["start", "stop", "restart", "status", "once"]),
  agents: z.array(z.enum(["morning", "news", "print"])).optional(),
});

async function ensureDirs() {
  await mkdir(PID_DIR, { recursive: true });
  await mkdir(DATA, { recursive: true });
}

function pidPath(key: AgentKey) {
  return path.join(PID_DIR, `${key}.pid`);
}

async function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid(key: AgentKey): Promise<number | null> {
  try {
    const raw = (await readFile(pidPath(key), "utf8")).trim();
    const pid = Number(raw);
    if (!Number.isFinite(pid) || pid <= 0) return null;
    if (!(await isAlive(pid))) {
      await unlink(pidPath(key)).catch(() => undefined);
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

async function stopOne(key: AgentKey) {
  const pid = await readPid(key);
  if (!pid) return { key, stopped: false, reason: "not running" };
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  await unlink(pidPath(key)).catch(() => undefined);
  return { key, stopped: true, pid };
}

async function startOne(key: AgentKey) {
  const existing = await readPid(key);
  if (existing) return { key, started: false, already: true, pid: existing };

  const child = spawn("python3", [AGENTS[key].script], {
    cwd: ROOT,
    env: process.env,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (!child.pid) {
    return { key, started: false, error: "spawn failed" };
  }
  child.unref();
  await writeFile(pidPath(key), String(child.pid), "utf8");
  return { key, started: true, pid: child.pid };
}

async function findLooseProcesses(): Promise<Partial<Record<AgentKey, number>>> {
  // Recover daemons started outside the PID files (tmux / npm scripts).
  return new Promise((resolve) => {
    const child = spawn("pgrep", ["-af", "agents/(morning_daemon|news_agent|print_daemon)\\.py"], {
      cwd: ROOT,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.on("close", () => {
      const found: Partial<Record<AgentKey, number>> = {};
      for (const line of out.split("\n")) {
        const m = line.match(/^(\d+)\s+.*agents\/(morning_daemon|news_agent|print_daemon)\.py/);
        if (!m) continue;
        const pid = Number(m[1]);
        const script = m[2];
        const key: AgentKey =
          script === "morning_daemon" ? "morning" : script === "news_agent" ? "news" : "print";
        found[key] = pid;
      }
      resolve(found);
    });
  });
}

async function statusPayload() {
  await ensureDirs();
  const loose = await findLooseProcesses();
  const agents: Record<string, unknown> = {};
  for (const key of Object.keys(AGENTS) as AgentKey[]) {
    let pid = await readPid(key);
    if (!pid && loose[key]) {
      pid = loose[key]!;
      await writeFile(pidPath(key), String(pid), "utf8").catch(() => undefined);
    }
    agents[key] = {
      key,
      label: AGENTS[key].label,
      running: Boolean(pid),
      pid: pid || null,
    };
  }

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(await readFile(path.join(DATA, "settings.json"), "utf8"));
  } catch {
    settings = {};
  }

  let morningState: Record<string, unknown> | null = null;
  try {
    morningState = JSON.parse(await readFile(path.join(DATA, "morning-daemon-state.json"), "utf8"));
  } catch {
    morningState = null;
  }

  const list = (settings.agents as Array<Record<string, unknown>> | undefined) || [];
  const active = list.filter((a) => a.enabled !== false);
  const dailyOn = Boolean((agents.morning as { running?: boolean }).running) && active.length > 0;

  return {
    ok: true,
    dailyOn,
    agents,
    deliveryAgents: active,
    lastRun: morningState
      ? {
          updatedAt: morningState.updatedAt,
          lastEmail: morningState.lastEmail,
          lastPrint: morningState.lastPrint,
          lastEditionHtml: morningState.lastEditionHtml,
        }
      : null,
    checkedAt: new Date().toISOString(),
    howItWorks: [
      "Create a delivery schedule (email time + print time).",
      "Optional: add free Gmail SMTP so email actually sends.",
      "Click Turn on every day — the morning agent stays running and fires at those times.",
      "Keep this machine on (or run the same agents on a server). Browser tabs are not required.",
    ],
  };
}

export async function GET() {
  return NextResponse.json(await statusPayload());
}

export async function POST(request: Request) {
  try {
    await ensureDirs();
    const body = schema.parse(await request.json().catch(() => ({ action: "status" })));
    const keys = (body.agents || ["morning", "news", "print"]) as AgentKey[];

    if (body.action === "status") {
      return NextResponse.json(await statusPayload());
    }

    if (body.action === "once") {
      const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn("python3", ["agents/morning_daemon.py", "--once"], {
          cwd: ROOT,
          env: process.env,
        });
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
      return NextResponse.json({
        ok: result.code === 0,
        mode: "once",
        ...(await statusPayload()),
        stdout: result.stdout.slice(-4000),
        stderr: result.stderr.slice(-1500),
      });
    }

    if (body.action === "stop") {
      const results = [];
      for (const key of keys) results.push(await stopOne(key));
      return NextResponse.json({ ok: true, action: "stop", results, ...(await statusPayload()) });
    }

    if (body.action === "restart") {
      for (const key of keys) await stopOne(key);
      // brief pause so ports/files settle
      await new Promise((r) => setTimeout(r, 400));
    }

    // start (and restart fall-through)
    const results = [];
    for (const key of keys) results.push(await startOne(key));

    // Touch a marker so UI can show "armed"
    await writeFile(
      path.join(DATA, "daily-agent.json"),
      JSON.stringify(
        {
          enabled: true,
          startedAt: new Date().toISOString(),
          agents: keys,
        },
        null,
        2,
      ),
      "utf8",
    );

    return NextResponse.json({
      ok: true,
      action: body.action,
      results,
      ...(await statusPayload()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent control failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
