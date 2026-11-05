import nodemailer from "nodemailer";
import type { NewsArticle, NewspaperEdition } from "./types";

function transporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

function editionHtml(edition: NewspaperEdition) {
  const items = edition.articles
    .map(
      (a) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #ddd;">
          <div style="font:11px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#666;">
            ${a.category}${a.breaking ? " · Breaking" : ""}
          </div>
          <h2 style="margin:6px 0 8px;font:700 22px/1.25 Georgia,serif;color:#111;">
            <a href="${a.url}" style="color:inherit;text-decoration:none;">${escapeHtml(a.title)}</a>
          </h2>
          <p style="margin:0;font:15px/1.55 Georgia,serif;color:#333;">${escapeHtml(a.summary)}</p>
          <div style="margin-top:8px;font:12px/1.4 ui-sans-serif,system-ui;color:#777;">${escapeHtml(a.source)}</div>
        </td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f4f4f1;color:#111;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f1;padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#fff;padding:36px 40px;border:1px solid #e4e4e0;">
              <tr>
                <td>
                  <div style="font:12px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#b42318;">Quietpress</div>
                  <h1 style="margin:10px 0 4px;font:700 34px/1.1 Georgia,serif;">${escapeHtml(edition.paperTitle)}</h1>
                  <div style="font:13px/1.4 ui-sans-serif,system-ui;color:#666;margin-bottom:24px;">${escapeHtml(edition.dateLabel)} · No ads · Interest-matched only</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
                  <p style="margin:28px 0 0;font:12px/1.5 ui-sans-serif,system-ui;color:#888;">
                    Sent by Quietpress. Open the app to print today's edition.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function breakingHtml(paperTitle: string, articles: NewsArticle[]) {
  const list = articles
    .map(
      (a) =>
        `<li style="margin:0 0 14px;"><strong style="font:700 16px/1.3 Georgia,serif;">${escapeHtml(a.title)}</strong><br/><span style="font:14px/1.5 Georgia,serif;color:#333;">${escapeHtml(a.summary)}</span></li>`,
    )
    .join("");

  return `<!doctype html>
  <html><body style="font-family:Georgia,serif;color:#111;padding:24px;">
    <div style="font:12px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#b42318;">Breaking · ${escapeHtml(paperTitle)}</div>
    <ul style="padding-left:18px;margin-top:16px;">${list}</ul>
  </body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendMorningEmail(to: string, edition: NewspaperEdition) {
  const html = editionHtml(edition);
  const subject = `${edition.paperTitle} — ${edition.dateLabel}`;
  return dispatch(to, subject, html, edition);
}

export async function sendBreakingEmail(to: string, paperTitle: string, articles: NewsArticle[]) {
  const html = breakingHtml(paperTitle, articles);
  const subject = `Breaking · ${paperTitle}`;
  return dispatch(to, subject, html, { articles });
}

async function dispatch(to: string, subject: string, html: string, debugPayload: unknown) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "quietpress@localhost";
  const tx = transporter();

  if (!tx) {
    console.info("[quietpress:email:mock]", { to, subject, preview: debugPayload });
    return {
      mode: "mock" as const,
      messageId: `mock-${Date.now()}`,
      preview: { to, subject },
    };
  }

  const info = await tx.sendMail({ from, to, subject, html });
  return { mode: "smtp" as const, messageId: info.messageId };
}
