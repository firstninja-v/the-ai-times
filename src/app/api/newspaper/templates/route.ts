import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FALLBACK = [
  {
    id: "classic",
    name: "Classic Broadsheet",
    description: "Traditional ink masthead, multi-column body, serif readability.",
    previewImage: "/templates/classic/preview.png",
    previewHtml: "/templates/classic/preview.html",
  },
  {
    id: "modern",
    name: "Modern Daily",
    description: "Clean Apple-like spacing, large lead image, soft rules.",
    previewImage: "/templates/modern/preview.png",
    previewHtml: "/templates/modern/preview.html",
  },
  {
    id: "compact",
    name: "Compact Brief",
    description: "Dense but readable morning brief for quick scanning.",
    previewImage: "/templates/compact/preview.png",
    previewHtml: "/templates/compact/preview.html",
  },
  {
    id: "broadsheet",
    name: "Sunday Broadsheet",
    description: "Wide editorial layout with feature photography.",
    previewImage: "/templates/broadsheet/preview.png",
    previewHtml: "/templates/broadsheet/preview.html",
  },
  {
    id: "magazine",
    name: "Magazine Fold",
    description: "Magazine-inspired feature spread with bold imagery.",
    previewImage: "/templates/magazine/preview.png",
    previewHtml: "/templates/magazine/preview.html",
  },
];

export async function GET() {
  try {
    const indexPath = path.join(process.cwd(), "public", "templates", "index.json");
    const raw = await readFile(indexPath, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ templates: FALLBACK, count: FALLBACK.length, fallback: true });
  }
}
