// The PDF report and the report email (design/pdf-report, design/emails/report-email).
// The PDF is rendered by the scoring service from the stored result (never the statement,
// never the account number) and is not kept anywhere: it is made on request.
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { sendMail } from "./mailer.ts";
import { getLinks } from "./settings.ts";
import { retestDays } from "./leads.ts";
import { siteUrl } from "./auth.ts";
import { DISCLAIMER } from "../disclaimer.ts";

const SCORING_URL = process.env.SCORING_URL || "http://127.0.0.1:8000";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Payload = {
  score: number | null; score_type: "full" | "early" | "starter"; evaluation_date: string;
  band?: { code: string; name: string; meaning: string } | null;
  pillars?: { key: string; name: string; score: number; metrics: { key: string; display: string | null }[] }[] | null;
  top_fixes?: { metric: string; name: string; diagnosis: string }[];
  starter?: { heading: string; line: string } | null;
};

export function retestDate(evaluationDate: string, band: string | null | undefined): string {
  const d = new Date(evaluationDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + retestDays(band));
  return d.toISOString().slice(0, 10);
}
const longDate = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "";
export function pdfFilename(name: string | null | undefined): string {
  const first = firstName(name).normalize("NFKD").replace(/[^A-Za-z0-9-]/g, "");
  return first ? `Manager-Test-Report-${first}.pdf` : "Manager-Test-Report.pdf";
}

// Everything the PDF shows, from the database.
export async function reportInput(resultId: string) {
  const [row] = await db().select().from(s.results).where(eq(s.results.id, resultId));
  if (!row) return null;
  const account = row.accountId ?? row.pendingAccountId;
  const [acct] = account ? await db().select({ name: s.accounts.name }).from(s.accounts).where(eq(s.accounts.id, account)) : [];
  const ins = await db().select().from(s.resultInsights).where(eq(s.resultInsights.resultId, resultId)).orderBy(asc(s.resultInsights.rank));
  const note = (f: typeof ins[number]) => ({ area: f.area, text: ((f.data ?? {}) as { text?: string }).text ?? "", action: ((f.data ?? {}) as { action?: string | null }).action ?? null });
  const payload = row.payload as Payload;
  return {
    payload,
    name: acct?.name ?? null,
    pdf: {
      result: payload,
      name: acct?.name ?? "",
      coach: { working: ins.filter((f) => f.polarity === "working").map(note), costing: ins.filter((f) => f.polarity === "costing").map(note) },
      links: await getLinks(),
      retest_date: payload.score_type === "starter" ? null : retestDate(row.evaluationDate, row.band),
    },
  };
}

export async function renderPdf(input: unknown): Promise<Buffer> {
  const res = await fetch(`${SCORING_URL}/pdf`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`pdf service ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const PAGES = (p: Payload) => (p.score_type === "starter" ? 4 : 7);
const PLAN_PAGE = 5;

// The report email, from design/emails/report-email.
// design/emails/report-email: the "Your dashboard" block (a plain link; nothing in it signs in).
const DASHBOARD_BLOCK = "Your score history, your goal and your coach notes, all in one place. On this device it opens straight away. Anywhere else, we'll email you a code.";

export function reportEmail(p: Payload, name: string | null, filename: string, links: Awaited<ReturnType<typeof getLinks>>, retest: string | null) {
  const site = siteUrl();
  const hi = firstName(name);
  const starter = p.score_type === "starter";
  const subject = starter ? "Your Manager Test report" : `Your Manager Test report: ${p.score}, ${p.band?.name ?? ""}`;
  const pre = starter ? "Your report is attached." : `Your score is ${p.score}, ${p.band?.name ?? ""}. The full PDF with your top 3 fixes is attached.`;
  const fix = p.top_fixes?.[0];
  const font = "font-family:Arial,Helvetica,sans-serif";
  const bars = (p.pillars ?? []).map((x, i) => `
<tr><td style="padding:${i ? 10 : 8}px 0 4px;">${esc(x.name)}</td><td align="right" style="padding:${i ? 10 : 8}px 0 4px;font-weight:bold;color:#0B1F3A;">${Math.round(x.score)}</td></tr>
<tr><td colspan="2"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="${Math.max(1, Math.round(x.score))}%" height="6" bgcolor="#0E6B4F" style="font-size:0;line-height:0;">&nbsp;</td><td height="6" bgcolor="#E7F1ED" style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>`).join("");
  const scoreBlock = starter ? "" : `
<tr><td class="px" style="padding:32px 40px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #DDE2E7;border-radius:12px;">
<tr><td style="padding:22px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="120" valign="middle" class="score" style="${font};font-size:64px;line-height:64px;font-weight:bold;color:#0B1F3A;letter-spacing:-2px;mso-line-height-rule:exactly;">${p.score}</td>
<td valign="middle" style="${font};"><p style="margin:0;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B7684;">Manager-Readiness score</p>
<p style="margin:6px 0 0;font-size:22px;line-height:28px;font-weight:bold;color:#0E6B4F;">${esc(p.band?.name)}</p>
<p style="margin:2px 0 0;font-size:14px;line-height:20px;color:#1C2430;">${esc(p.band?.meaning)}</p></td></tr></table></td></tr>
<tr><td style="padding:0 24px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${font};font-size:14px;line-height:20px;color:#1C2430;">${bars}</table></td></tr>
</table></td></tr>`;
  const fixBlock = fix ? `<p style="margin:0;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#0E6B4F;">Your first fix</p>
<p style="margin:8px 0 0;font-size:18px;line-height:26px;font-weight:bold;color:#0B1F3A;">${esc(fix.name)}.</p>
<p style="margin:6px 0 0;font-size:15px;line-height:23px;color:#1C2430;">${esc(fix.diagnosis)} Page ${PLAN_PAGE} of your report walks you through the fix, step by step, with fixes 2 and 3.</p>` : "";
  const webinar = links.link_webinar ? `
<tr><td class="px" style="padding:28px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E4A44" style="background-color:#0E4A44;border-radius:12px;"><tr><td style="padding:24px;${font};">
<p style="margin:0;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#9FDCBE;">Free live webinar${links.webinar_when ? " · " + esc(links.webinar_when) : ""}</p>
<p style="margin:10px 0 0;font-size:21px;line-height:27px;font-weight:bold;color:#F5F6F4;">Your Money Management Journey Starts Here</p>
<p style="margin:8px 0 18px;font-size:15px;line-height:22px;color:#E6EAEE;">From trading for friends to managing professionally, bring your score</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#0E6B4F" style="background-color:#0E6B4F;border-radius:999px;border:1px solid #9FDCBE;">
<a href="${esc(links.link_webinar)}" style="display:block;padding:14px 26px;${font};font-size:14px;line-height:16px;font-weight:bold;letter-spacing:0.5px;color:#FFFFFF;text-decoration:none;">Save my free seat</a></td></tr></table>
</td></tr></table></td></tr>` : "";
  const days = retestDays(p.band?.code);
  const retestLine = retest ? `<p style="margin:0 0 18px;font-size:15px;line-height:23px;color:#1C2430;">Improving your record? Take the test again in ${days} days, on or after <strong>${longDate(retest)}</strong>, at <a href="${site}" style="color:#0E6B4F;font-weight:bold;text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ""))}</a>.</p>` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(subject)}</title>
<style>@media (max-width:620px) { .px { padding-left:20px !important; padding-right:20px !important; } .h1 { font-size:26px !important; line-height:32px !important; } .score { font-size:56px !important; line-height:56px !important; } }</style></head>
<body style="margin:0;padding:0;background-color:#F3F4F2;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3F4F2;">${esc(pre)} ͏ ͏ ͏</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F2;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
<tr><td class="px" bgcolor="#0B1F3A" style="background-color:#0B1F3A;padding:28px 40px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="${font};font-size:22px;line-height:24px;font-weight:bold;color:#F5F6F4;letter-spacing:-0.5px;mso-line-height-rule:exactly;">beta</td>
<td align="right" style="${font};font-size:11px;line-height:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#C3CBD5;">The Manager Test</td></tr></table>
<p class="h1" style="margin:28px 0 0;${font};font-size:30px;line-height:36px;font-weight:bold;color:#F5F6F4;mso-line-height-rule:exactly;">Your report is attached${hi ? ", " + esc(hi) : ""}.</p>
<p style="margin:10px 0 0;${font};font-size:16px;line-height:24px;color:#C3CBD5;">Every metric behind your score, your top 3 fixes and how professional managers compare.</p>
</td></tr>${scoreBlock}
<tr><td class="px" style="padding:20px 40px 0;${font};">${fixBlock}
<p style="margin:16px 0 0;font-size:14px;line-height:21px;color:#4C5A6E;">Attached: <strong style="color:#0B1F3A;">${esc(filename)}</strong> (${PAGES(p)} pages)</p></td></tr>${webinar}
<tr><td class="px" style="padding:28px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #DDE2E7;border-bottom:1px solid #DDE2E7;"><tr><td valign="top" style="padding:20px 16px 20px 0;${font};">
<p style="margin:0;font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6B7684;">Your dashboard</p>
<p style="margin:8px 0 0;font-size:15px;line-height:23px;color:#1C2430;">${DASHBOARD_BLOCK}</p>
<p style="margin:10px 0 0;font-size:15px;line-height:23px;"><a href="${site}/dashboard" style="color:#0E6B4F;font-weight:bold;text-decoration:underline;">Open my dashboard →</a></p>
</td></tr></table></td></tr>
<tr><td class="px" style="padding:24px 40px 32px;${font};">${retestLine}<p style="margin:0;font-size:15px;line-height:23px;color:#1C2430;">The Beta team</p></td></tr>
<tr><td class="px" bgcolor="#FAFAF8" style="background-color:#FAFAF8;padding:24px 40px;border-top:1px solid #DDE2E7;${font};">
<p style="margin:0;font-size:12px;line-height:18px;color:#4C5A6E;">${esc(DISCLAIMER)}</p>
<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#4C5A6E;">The Manager Test by Beta · [Company postal address]<br>You're receiving this because you requested your report. <a href="${site}/settings" style="color:#0E6B4F;text-decoration:underline;">Unsubscribe</a> · <a href="https://betaapp.me/privacy" style="color:#0E6B4F;text-decoration:underline;">Privacy policy</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    `Your report is attached${hi ? ", " + hi : ""}.`, "",
    starter ? "" : `Your score is ${p.score}, ${p.band?.name ?? ""}. ${p.band?.meaning ?? ""}`,
    fix ? `Your first fix: ${fix.name}. ${fix.diagnosis} Page ${PLAN_PAGE} of your report walks you through the fix, step by step, with fixes 2 and 3.` : "",
    `Attached: ${filename} (${PAGES(p)} pages)`,
    "", `Your dashboard: ${DASHBOARD_BLOCK} Open my dashboard: ${site}/dashboard`,
    links.link_webinar ? `Free live webinar${links.webinar_when ? " · " + links.webinar_when : ""}: Your Money Management Journey Starts Here. Save my free seat: ${links.link_webinar}` : "",
    retest ? `Improving your record? Take the test again in ${days} days, on or after ${longDate(retest)}, at ${site}.` : "",
    "The Beta team", "", DISCLAIMER,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  return { subject, html, text };
}

// After the lead: render the PDF and email it. Recorded in the email log either way.
export async function sendReport(resultId: string, to: string, accountId: string): Promise<boolean> {
  try {
    const input = await reportInput(resultId);
    if (!input) return false;
    const name = input.name;
    const filename = pdfFilename(name);
    const pdf = await renderPdf(input.pdf);
    const mail = reportEmail(input.payload, name, filename, input.pdf.links, input.pdf.retest_date);
    const sent = await sendMail({ to, ...mail, kind: "report", attachments: [{ filename, content: pdf }] });
    await db().insert(s.emailLog).values({ accountId, kind: "report", subject: mail.subject, status: "sent", sentAt: new Date(), providerId: sent.id });
    return true;
  } catch {
    await db().insert(s.emailLog).values({ accountId, kind: "report", status: "failed" }).catch(() => undefined);
    return false;
  }
}
