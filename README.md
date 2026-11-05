# The AI Times

**Your personal — or company — morning newspaper.**  
Interest-matched. Ad-free. Sourced from premium wires. Scraped daily with [Scrapling](https://github.com/D4Vinci/Scrapling). Emailed every morning. Printed on a hands-free loop.

## What it does

- **Personal papers** — *The Sairam Times*, Daily News, Herald, Post, custom mastheads
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

### Designed newspaper PDFs/HTML (Python studio)

Ready-made templates: `classic`, `modern`, `compact`, `broadsheet`, `magazine`.

```bash
# list templates
npm run agent:paper -- --list-templates

# generate today (offline desk editor if no key)
npm run agent:paper -- --template modern --pages 4

# use any small OpenAI-compatible model
export LLM_API_KEY=sk-...
export LLM_BASE_URL=https://api.openai.com/v1   # or Groq / Together / Ollama
export LLM_MODEL=gpt-4o-mini
npm run agent:paper -- --template classic --email you@example.com

# render every template
npm run agent:paper -- --all-templates --no-llm
```

Editions land in `.ai-times/editions/`. Copy `agents/.env.example` for LLM + SMTP.

### Always-on agents (keep running)

```bash
# Terminal A — continuous Scrapling + wire collection
npm run agent:news

# Terminal B — continuous printer discovery + scheduled auto-print
npm run agent:print

# Terminal C — optional daily designed paper (cron this)
npm run agent:paper:daily
```

Optional env:

```bash
export AI_TIMES_API=http://127.0.0.1:43123
export AI_TIMES_AGENT_POLL=90
export AI_TIMES_PRINT_POLL=30
# Network printers: name|ipp://host/printers/queue,name2|ipp://...
export IPP_PRINTERS="lobby|ipp://192.168.1.50/ipp/print"
```

### Email (optional)

Copy `.env.example` → `.env.local` and set SMTP. Without SMTP, sends are mocked to the server log.

## Architecture

| Piece | Role |
|---|---|
| Next.js app | Setup, company papers, edition UI, ingest + print APIs |
| `agents/news_agent.py` | Scrapling + premium RSS desk, importance scoring, inbox + breaking ingest |
| `agents/print_daemon.py` | Printer registry, settings, forever loop, auto print at `printTime` |
| `.ai-times/` | Local runtime: inbox, profiles, printers, print queue |

## Company paper flow

1. Open **/company**
2. Enter company, industry, keywords, competitors
3. Save → profile syncs into `.ai-times/profiles/`
4. News agent boosts matching stories all day
5. Print daemon fires the edition at the company print time

## License

MIT
