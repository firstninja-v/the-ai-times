import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const root = path.join(process.cwd(), ".ai-times");
  try {
    const [agentState, printState, printers, inboxFiles] = await Promise.all([
      readJson(path.join(root, "agent-state.json")),
      readJson(path.join(root, "print-daemon-state.json")),
      readJson(path.join(root, "printers.json")),
      readdir(path.join(root, "inbox")).catch(() => [] as string[]),
    ]);

    return NextResponse.json({
      ok: true,
      newsAgent: agentState,
      printDaemon: printState,
      printers: printers?.printers ?? [],
      inboxBatches: (inboxFiles as string[]).filter((f) => f.endsWith(".json")).length,
      tips: {
        newsAgent: "npm run agent:news",
        printDaemon: "npm run agent:print",
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "No agent state yet",
      tips: {
        newsAgent: "npm run agent:news",
        printDaemon: "npm run agent:print",
      },
    });
  }
}

async function readJson(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}
