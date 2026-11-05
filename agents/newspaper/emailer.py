from __future__ import annotations

import mimetypes
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

from .config import EmailConfig


def send_edition_email(
    *,
    to_email: str,
    subject: str,
    html_path: Path,
    config: EmailConfig | None = None,
    attach_html: bool = True,
) -> dict:
    config = config or EmailConfig()
    html = html_path.read_text("utf-8")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.sender
    msg["To"] = to_email
    msg.set_content(
        "Your AI Times edition is ready. Open this email in an HTML-capable client to read the paper."
    )
    msg.add_alternative(html, subtype="html")

    if attach_html:
        data = html_path.read_bytes()
        mime, _ = mimetypes.guess_type(html_path.name)
        maintype, subtype = (mime or "text/html").split("/", 1)
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=html_path.name)

    if not config.configured:
        preview = Path(html_path).with_suffix(".email-preview.txt")
        preview.write_text(
            f"TO: {to_email}\nFROM: {config.sender}\nSUBJECT: {subject}\n\n"
            f"[SMTP not configured — HTML edition at {html_path}]\n",
            encoding="utf-8",
        )
        print(f"[email] SMTP not configured. Wrote preview → {preview}")
        return {"mode": "mock", "preview": str(preview), "to": to_email, "subject": subject}

    if config.use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(config.host, config.port, context=context) as smtp:
            smtp.login(config.user, config.password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(config.host, config.port) as smtp:
            smtp.ehlo()
            if config.use_tls:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            smtp.login(config.user, config.password)
            smtp.send_message(msg)

    print(f"[email] sent to {to_email}: {subject}")
    return {"mode": "smtp", "to": to_email, "subject": subject}
