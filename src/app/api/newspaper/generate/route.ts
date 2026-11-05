import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  template: z.enum(["classic", "modern", "compact", "broadsheet", "magazine"]).default("classic"),
  title: z.string().optional(),
  company: z.string().optional(),
  pages: z.number().int().min(1).max(12).default(4),
  email: z.string().email().optional(),
  useLlm: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const args = [
      "-m",
      "agents.newspaper",
      "--template",
      body.template,
      "--pages",
      String(body.pages),
      "--max-articles",
      "10",
    ];
    if (body.title) args.push("--title", body.title);
    if (body.company) args.push("--company", body.company);
    if (body.email) args.push("--email", body.email);
    if (!body.useLlm) args.push("--no-llm");

    const result = await runPython(args);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Newspaper generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function runPython(args: string[]) {
  return new Promise<{ stdout: string; code: number }>((resolve, reject) => {
    const child = spawn("python3", args, {
      cwd: process.cwd(),
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
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `python exited ${code}`));
        return;
      }
      resolve({ stdout, code: code ?? 0 });
    });
  });
}
