import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { z } from "zod";

const schema = z.object({
  template: z.enum(["classic", "modern", "compact", "broadsheet", "magazine"]).default("classic"),
  title: z.string().optional(),
  company: z.string().optional(),
  pages: z.number().int().min(1).max(12).default(4),
  email: z.string().email().optional(),
  useLlm: z.boolean().default(false),
  newsPrompt: z.string().optional(),
  byok: z
    .object({
      enabled: z.boolean(),
      provider: z.string(),
      apiKey: z.string(),
      baseUrl: z.string(),
      model: z.string(),
    })
    .optional(),
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
    if (body.newsPrompt) args.push("--prompt", body.newsPrompt);

    const env = { ...process.env };
    const byokReady = Boolean(body.byok?.enabled && body.byok.apiKey);
    if (byokReady && body.byok) {
      env.LLM_API_KEY = body.byok.apiKey;
      env.LLM_BASE_URL = body.byok.baseUrl;
      env.LLM_MODEL = body.byok.model;
      body.useLlm = true;
    }
    if (!body.useLlm && !byokReady) args.push("--no-llm");

    const { stdout, stderr, code } = await runPython(args, env);
    if (code !== 0) {
      return NextResponse.json({ error: stderr || stdout || "Generation failed" }, { status: 500 });
    }

    const match = stdout.split("\n").reverse().find((line) => line.startsWith("RESULT_JSON="));
    const result = match ? JSON.parse(match.replace("RESULT_JSON=", "")) : null;

    return NextResponse.json({
      ok: true,
      result,
      stdout,
      openUrl: result?.publicUrl || result?.latestUrl || "/editions/latest.html",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Newspaper generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function runPython(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    const child = spawn("python3", args, {
      cwd: process.cwd(),
      env,
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
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}
