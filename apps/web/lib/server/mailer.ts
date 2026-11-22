// Outgoing email through Brevo (transactional API) when BREVO_API_KEY is set; otherwise
// (local and tests only) an in-memory outbox. On the production site a missing key is an
// error, never a silent skip.
// MAIL_FROM: the sender address, on a domain authenticated in Brevo (SPF/DKIM on betaapp.me).
// MAIL_FROM_NAME: the sender name shown in the inbox.
import { isProductionSite } from "../site.ts";

export type Attachment = { filename: string; content: Buffer };
export type Mail = { to: string; subject: string; html: string; text: string; kind: string; attachments?: Attachment[] };
export const outbox: Mail[] = [];

export const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
export const DEFAULT_FROM_NAME = "The Manager Test by Beta";

// The request body Brevo expects.
export function brevoBody(mail: Mail, from = process.env.MAIL_FROM, fromName = process.env.MAIL_FROM_NAME || DEFAULT_FROM_NAME) {
  if (!from) throw new Error("MAIL_FROM is not set");
  return {
    sender: { name: fromName, email: from },
    to: [{ email: mail.to }],
    subject: mail.subject,
    htmlContent: mail.html,
    textContent: mail.text,
    tags: [mail.kind],
    ...(mail.attachments?.length ? { attachment: mail.attachments.map((a) => ({ name: a.filename, content: a.content.toString("base64") })) } : {}),
  };
}

export async function sendMail(mail: Mail): Promise<{ id: string | null }> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    if (isProductionSite()) throw new Error("BREVO_API_KEY is not set");
    outbox.push(mail);
    return { id: null };
  }
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(brevoBody(mail)),
    signal: AbortSignal.timeout(15_000),
  });
  // Never log the body: it holds the recipient and, for reports, their results.
  if (!res.ok) throw new Error(`email provider error ${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { id: body.messageId ?? null };
}
