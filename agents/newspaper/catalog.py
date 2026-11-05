from __future__ import annotations

import json
from pathlib import Path

from .config import ROOT, TEMPLATES_META

PUBLIC_PREVIEWS = ROOT / "public" / "templates"


def get_catalog() -> dict:
    index = PUBLIC_PREVIEWS / "index.json"
    if index.exists():
        return json.loads(index.read_text("utf-8"))

    templates = []
    for key, meta in TEMPLATES_META.items():
        preview_png = PUBLIC_PREVIEWS / key / "preview.png"
        preview_html = PUBLIC_PREVIEWS / key / "preview.html"
        templates.append(
            {
                "id": key,
                **meta,
                "previewHtml": f"/templates/{key}/preview.html" if preview_html.exists() else None,
                "previewImage": f"/templates/{key}/preview.png" if preview_png.exists() else None,
                "ready": preview_html.exists(),
            }
        )
    return {"templates": templates, "count": len(templates)}
