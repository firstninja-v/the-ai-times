from __future__ import annotations

FONTS = {
    "georgia": {
        "label": "Georgia",
        "stack": 'Georgia, "Times New Roman", serif',
    },
    "newsreader": {
        "label": "Newsreader",
        "stack": '"Newsreader", Georgia, "Times New Roman", serif',
        "import": "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&display=swap",
    },
    "libre": {
        "label": "Libre Baskerville",
        "stack": '"Libre Baskerville", Georgia, serif',
        "import": "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap",
    },
    "helvetica": {
        "label": "Helvetica",
        "stack": '"Helvetica Neue", Helvetica, Arial, sans-serif',
    },
    "system": {
        "label": "System UI",
        "stack": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
}


def apply_design(html: str, *, font: str = "georgia", color_mode: str = "color", pages: int | None = None) -> str:
    font_meta = FONTS.get(font, FONTS["georgia"])
    imports = ""
    if font_meta.get("import"):
        imports = f'<link rel="stylesheet" href="{font_meta["import"]}" />\n'
    grayscale = (
        "img, figure { filter: grayscale(1) contrast(1.04) !important; }"
        if color_mode == "bw"
        else ""
    )
    page_hint = f"/* requested pages: {pages} */" if pages else ""
    override = f"""
{imports}<style id="ait-design-overrides">
{page_hint}
@page {{ size: A4 portrait; margin: 10mm; }}
body, .page, .summary, p, h1, h2, h3, h4 {{
  font-family: {font_meta["stack"]} !important;
}}
.page {{
  width: 210mm !important;
  min-height: 297mm !important;
}}
{grayscale}
</style>
"""
    if "</head>" in html:
        return html.replace("</head>", override + "</head>", 1)
    return override + html
