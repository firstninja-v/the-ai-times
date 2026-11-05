import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { z } from "zod";

const schema = z.object({
  template: z.enum(["classic", "modern", "compact", "broadsheet", "magazine"]).default("classic"),
  title: z.string().optional(),
  company: z.string().optional(),
  pages: z.number().int().min(1).max(12).default(4),
  font: z.enum(["georgia", "newsreader", "libre", "helvetica", "system"]).default("georgia"),
  colorMode: z.enum(["bw", "color"]).default("color"),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.includes("@") ? v : undefined)),
  useLlm: z.boolean().default(false),
  newsPrompt: z.string().optional(),
  allTemplates: z.boolean().default(false),
  puzzles: z
    .array(z.enum(["crossword", "sudoku", "wordsearch", "cryptogram", "trivia"]))
    .optional(),
  puzzleDifficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  contentVolume: z.enum(["less", "medium", "more"]).default("more"),
  byok: z
    .object({
      enabled: z.boolean(),
      provider: z.string(),
      apiKey: z.string().optional().default(""),
      baseUrl: z.string().optional().default("https://api.openai.com/v1"),
      model: z.string().optional().default("gpt-4o-mini"),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const volumeMax = body.contentVolume === "less" ? 14 : body.contentVolume === "medium" ? 24 : 36;
    const maxArticles = Math.max(volumeMax, body.pages * (body.contentVolume === "less" ? 8 : 12));
    const args = [
      "-m",
      "agents.newspaper",
      "--pages",
      String(body.pages),
      "--max-articles",
      String(maxArticles),
      "--volume",
      body.contentVolume,
    ];

    if (body.allTemplates) {
      args.push("--all-templates");
    } else {
      args.push("--template", body.template);
    }
    args.push("--font", body.font, "--color", body.colorMode);
    args.push("--puzzle-difficulty", body.puzzleDifficulty);
    if (body.puzzles) {
      args.push("--puzzles", body.puzzles.length ? body.puzzles.join(",") : "none");
    }
    if (body.title) args.push("--title", body.title);
    if (body.company) args.push("--company", body.company);
    if (body.email) args.push("--email", body.email);
    if (body.newsPrompt) args.push("--prompt", body.newsPrompt);

    const env = { ...process.env };
    const isOllama =
      body.byok?.provider === "ollama" ||
      (body.byok?.baseUrl || "").includes("11434") ||
      (body.byok?.baseUrl || "").toLowerCase().includes("ollama");
    const byokReady = Boolean(
      body.byok?.enabled && (body.byok.apiKey?.trim() || isOllama),
    );
    if (byokReady && body.byok) {
      env.LLM_API_KEY = (body.byok.apiKey || (isOllama ? "ollama" : "")).trim();
      env.LLM_BASE_URL = (body.byok.baseUrl || "https://api.openai.com/v1").trim();
      env.LLM_MODEL = (body.byok.model || "gpt-4o-mini").trim();
    }

    if (!body.useLlm && !byokReady) {
      args.push("--no-llm");
    }

    const { stdout, stderr, code } = await runPython(args, env);
    if (code !== 0) {
      return NextResponse.json(
        { error: (stderr || stdout || "Generation failed").slice(0, 2000) },
        { status: 500 },
      );
    }

    const results = stdout
      .split("\n")
      .filter((line) => line.startsWith("RESULT_JSON="))
      .map((line) => JSON.parse(line.replace("RESULT_JSON=", "")));

    const latest = results.at(-1) || null;

    return NextResponse.json({
      ok: true,
      result: latest,
      results,
      stdout: stdout.slice(-4000),
      openUrl: latest?.publicUrl || latest?.latestUrl || "/editions/latest.html",
      llmUsed: Boolean(latest?.llm),
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
