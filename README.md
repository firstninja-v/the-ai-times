# The AI Times

**Your personal — or company — morning newspaper.**  
Interest-matched. Ad-free. Sourced from premium wires. Scraped daily with [Scrapling](https://github.com/D4Vinci/Scrapling). Emailed every morning. Printed on a hands-free loop.

## What it does

- **Personal papers** — *The [Your Name] Times*, Daily News, Herald, Post, custom mastheads
- **Company papers** — brand / market / competitor keywords → a private company newspaper
- **Premium providers** — BBC, Guardian, TechCrunch, NPR, AP & Bloomberg via Google News RSS, plus Scrapling HTML desks
- **Always-on news agent** — Scrapling + RSS loop that scores importance and raises breaking alerts
- **Hands-free print daemon** — discovers CUPS / IPP / PDF printers, stores paper settings, auto-prints at the chosen time without another click

## Quick start

```bash
npm install
npm run agents:install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

### Design studio (templates + BYOK)

Open [/studio](http://127.0.0.1:43123/studio):

1. Click a template card — live HTML preview updates immediately
2. Paste your API key (OpenAI / Claude / Gemini / Groq / Ollama)
3. Choose **pages**, **font**, and **black & white vs color**
4. **Generate** one paper or **Generate all templates**

The Next.js API passes those options + your key into the Python generator (`agents/newspaper`), which writes readable image-rich HTML under `public/editions/`.

### Designed newspaper HTML (CLI)

Ready-made templates: `classic`, `modern`, `compact`, `broadsheet`, `magazine`.

```bash
# list templates
npm run agent:paper -- --list-templates

# generate today (offline desk editor if no key)
npm run agent:paper -- --template modern --pages 4 --font newsreader --color bw

# use any small OpenAI-compatible model
export LLM_API_KEY=sk-...
export LLM_BASE_URL=https://api.openai.com/v1   # or Groq / Together / Ollama
export LLM_MODEL=gpt-4o-mini
npm run agent:paper -- --template classic --email you@example.com

# render every template
npm run agent:paper -- --all-templates --no-llm

# refresh visual previews for the studio gallery
npm run agent:paper:previews
```

Editions land in `.ai-times/editions/` and `public/editions/`. Copy `agents/.env.example` for LLM + SMTP.

### Always-on agents (keep running)

```bash
# Terminal A — continuous Scrapling + wire collection
npm run agent:news

# Terminal B — morning agent: generate A4 paper → email → print on schedule
npm run agent:morning

# Terminal C — printer discovery + scheduled auto-print fallback
npm run agent:print

# Smoke test morning pipeline once (generate + mock email + PDF/HTML print file)
npm run agent:morning:once

# One-shot daily paper (cron-friendly)
npm run agent:paper:daily
```

Papers render at **A4** (`210mm × 297mm`) with dense multi-column layouts.

### Reading volume

In Setup or Studio, pick **Less / Medium / More**:
- **Less** — ~10 shorter stories  
- **Medium** — ~18 balanced pieces  
- **More** — ~28 longer bodies (default)

```bash
npm run agent:paper -- --volume more --pages 4
```

### Games desk (daily puzzles)

Pick any of five classic paper games in Setup or Studio — **Crossword, Sudoku, Word Search, Cryptogram, Trivia** — with Easy / Medium / Hard.  
Each day the Python desk mints a **new unique board** (fingerprints stored in `.ai-times/puzzles/`) and skips news stories already printed, so neither games nor wires repeat.

```bash
npm run agent:paper -- --puzzles crossword,sudoku,wordsearch,cryptogram,trivia --puzzle-difficulty hard
```

Optional env:

```bash
export AI_TIMES_API=http://127.0.0.1:43123
export AI_TIMES_AGENT_POLL=90
export AI_TIMES_PRINT_POLL=30
# Network printers: name|ipp://host/printers/queue,name2|ipp://...
export IPP_PRINTERS="lobby|ipp://192.168.1.50/ipp/print"
```

### Settings — agents, printers, email, share

Open [/settings](http://127.0.0.1:43123/settings):

1. **Create agent** — schedule morning generate → email → print
2. **Connect printer** — discover CUPS/IPP or use PDF fallback + browser Print
3. **Email** — free Gmail App Password / any SMTP (also writable via Settings → saves `agents/.env`)
4. **Share** — WhatsApp link, Slack incoming webhook, mailto draft, or copy edition URL
5. **Run once now** — smoke-test the full delivery loop immediately

Images prefer original wire photos; when a feed has no image (or reuses the same asset), the desk draws a **unique** editorial placeholder — never repeating stock pets.

### Email (optional)

Use **Settings → Email**, or copy `.env.example` → `.env.local` and set SMTP. Without SMTP, the agent still writes a local email preview so the loop keeps working.

## Architecture

| Piece | Role |
|---|---|
| Next.js app | Setup, studio, Settings (agents/printers/email/share), edition UI |
| `agents/news_agent.py` | Scrapling + premium RSS desk, importance scoring, inbox + breaking ingest |
| `agents/morning_daemon.py` | Generate A4 paper → email → print on agent schedule |
| `agents/print_daemon.py` | Printer registry, settings, forever loop, auto print at `printTime` |
| `.ai-times/` | Local runtime: inbox, profiles, printers, settings, print queue |

## Company paper flow

1. Open **/company**
2. Enter company, industry, keywords, competitors
3. Save → profile syncs into `.ai-times/profiles/`
4. News agent boosts matching stories all day
5. Print daemon fires the edition at the company print time

## License

MIT
