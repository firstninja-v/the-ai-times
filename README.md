# Quietpress

**Your personal morning newspaper.** Interest-matched. Ad-free. Emailed every morning. Printed at your desk. Interrupted only for breaking news that actually matters.

Quietpress turns the open web’s RSS into a multi-page paper named after you — *The Sairam Times*, *Daily News*, *The Herald*, and more — then delivers it on your schedule.

## Why it exists

Most news products optimize for engagement. Quietpress optimizes for **signal**:

- You pick interests; everything else is cut
- Sponsored / shopping / celebrity-slop patterns are filtered out
- Morning email + optional local printer agent
- Breaking alerts only when a story is urgent *and* on-interest
- Black & white or color editions

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

1. **Compose your paper** — name, masthead style, interests, color, schedule  
2. **Open today’s edition** — multi-page, print-ready layout  
3. **Email now / Print** — test delivery from the edition toolbar  

### Real email (optional)

Copy `.env.example` → `.env.local` and set SMTP credentials. Without SMTP, Quietpress logs a mock send to the server console so local demos still work.

### Daily printer

```bash
npm run print-agent
```

Keep this running on the machine attached to your printer. When Quietpress queues a morning job (or you click **Print**), the agent:

1. Writes a print-ready HTML edition under `.quietpress/print-output/`
2. Sends it to CUPS via `lp` when available
3. Otherwise leaves the HTML for you to open and print

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- RSS aggregation with interest scoring and slop filters
- Nodemailer for morning + breaking mail
- Local print queue + CUPS agent

Built lean (Ponytail-style): one product slice, no fake microservices, no auth wall for the free local path.

## Product path

This repo is the open core. A hosted free tier can wrap the same edition engine later — profiles, managed SMTP, and always-on breaking checks — without changing the paper itself.

## License

MIT
