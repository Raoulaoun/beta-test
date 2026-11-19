// Outgoing email. Resend when RESEND_API_KEY is set; otherwise (local and tests only) an
// in-memory outbox. On the production site a missing key is an error, never a silent skip.
import { isProductionSite } from "../site.ts";

export type Attachment = { filename: string; content: Buffer };
export type Mail = { to: string; subject: string; html: string; text: string; kind: string; attachments?: Attachment[] };
export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<{ id: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isProductionSite()) throw new Error("RESEND_API_KEY is not set");
    outbox.push(mail);
    return { id: null };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text,
      ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) } : {}) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`email provider error ${res.status}`);
  const body = (await res.json()) as { id?: string };
  return { id: body.id ?? null };
}
