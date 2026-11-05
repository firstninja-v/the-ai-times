#!/usr/bin/env node
/**
 * Quietpress local print agent.
 * Watches `.quietpress/print-queue` and prints queued editions via CUPS (`lp`)
 * or writes a print-ready HTML file you can open and print manually.
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const queueDir = path.join(root, ".quietpress", "print-queue");
const doneDir = path.join(root, ".quietpress", "print-done");
const outDir = path.join(root, ".quietpress", "print-output");

await mkdir(queueDir, { recursive: true });
await mkdir(doneDir, { recursive: true });
await mkdir(outDir, { recursive: true });

console.log("Quietpress print agent watching", queueDir);

async function renderHtml(job) {
  const { edition } = job;
  const pages = edition.pages
    .map((page) => {
      const sections = page.sections
        .map((section) => {
          const articles = section.articles
            .map(
              (a) => `
              <article style="margin:0 0 24px;break-inside:avoid;">
                <div style="font:10px/1.2 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#999;">${a.category}</div>
                <h2 style="margin:6px 0 8px;font:700 ${section.layout === "lead" ? "34px" : "20px"}/1.2 Georgia,serif;">${escape(a.title)}</h2>
                <p style="margin:0;font:15px/1.55 Georgia,serif;color:#222;">${escape(a.summary)}</p>
              </article>`,
            )
            .join("");
          return `<section>${section.heading ? `<h3 style="font:12px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#666;">${escape(section.heading)}</h3>` : ""}${articles}</section>`;
        })
        .join("");

      return `
        <section class="sheet" style="page-break-after:always;padding:28px 32px;">
          <header style="text-align:center;margin-bottom:24px;">
            <div style="font:10px/1 ui-monospace,monospace;letter-spacing:.24em;text-transform:uppercase;color:#b42318;">Quietpress</div>
            <h1 style="margin:8px 0;font:700 42px/1.05 Georgia,serif;">${escape(edition.paperTitle)}</h1>
            <div style="font:11px/1.4 ui-sans-serif,system-ui;color:#666;">${escape(edition.dateLabel)} · Page ${page.number}</div>
            <hr style="border:none;border-top:3px solid #111;margin:14px 0 0;" />
          </header>
          ${sections}
        </section>`;
    })
    .join("");

  const grayscale = edition.colorMode === "bw" ? "filter:grayscale(1);" : "";
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escape(edition.paperTitle)}</title>
      <style>
        body{margin:0;background:#fff;color:#111;${grayscale}}
        @media print {.sheet{page-break-after:always}}
      </style>
    </head>
    <body>${pages}</body>
  </html>`;
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canUseLp() {
  return new Promise((resolve) => {
    const child = spawn("which", ["lp"], { stdio: "ignore" });
    child.on("close", (code) => resolve(code === 0));
  });
}

async function printFile(htmlPath) {
  if (await canUseLp()) {
    await new Promise((resolve, reject) => {
      const child = spawn("lp", [htmlPath], { stdio: "inherit" });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`lp exited ${code}`))));
    });
    return "lp";
  }
  return "file";
}

async function processJob(file) {
  const full = path.join(queueDir, file);
  const raw = await readFile(full, "utf8");
  const job = JSON.parse(raw);
  const html = await renderHtml(job);
  const outPath = path.join(outDir, file.replace(/\.json$/, ".html"));
  await writeFile(outPath, html, "utf8");
  const mode = await printFile(outPath);
  await rename(full, path.join(doneDir, file));
  console.log(`Printed ${file} via ${mode} → ${outPath}`);
}

async function tick() {
  if (!existsSync(queueDir)) return;
  const files = (await readdir(queueDir)).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    try {
      await processJob(file);
    } catch (error) {
      console.error(`Failed ${file}:`, error.message || error);
    }
  }
}

await tick();
setInterval(tick, 15_000);
