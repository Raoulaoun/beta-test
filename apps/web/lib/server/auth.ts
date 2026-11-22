// Sign in with a 6-digit code by email (design/account, sign-in states; design/emails/code-email).
// Codes: only sha256(email:code) is stored, 10 minutes, single use, void after 5 wrong tries,
// at most 5 codes per email per hour. An unknown email behaves exactly like a wrong code.
// Signing in also claims results held as pending for the account, and the result on screen.
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { newToken, sameHash, sha256 } from "./crypto.ts";
import { normaliseEmail } from "./leads.ts";
import { sendMail } from "./mailer.ts";
import { createSession } from "./session.ts";
import { ownedResult } from "./results.ts";
import { codeEmail } from "./codeEmail.ts";

export const CODE_REQUESTS_PER_HOUR = 5;

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}


export const CODE_MINUTES = 10;
export const CODE_ATTEMPTS = 5;
const codeHash = (email: string, code: string) => sha256(`${email}:${code}`);
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export type RequestOutcome = { outcome: "sent" } | { outcome: "rate_limited"; minutes: number };

// Same outcome whether or not the email has an account. When limited, `minutes` is how long
// until the oldest of the last 5 requests leaves the hour.
export async function requestSignInCode(rawEmail: string, code = newCode()): Promise<RequestOutcome> {
  const email = normaliseEmail(rawEmail);
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await db().select({ at: s.authTokens.createdAt }).from(s.authTokens)
    .where(and(eq(s.authTokens.email, email), gt(s.authTokens.createdAt, hourAgo))).orderBy(asc(s.authTokens.createdAt));
  if (recent.length >= CODE_REQUESTS_PER_HOUR) {
    const freeAt = recent[recent.length - CODE_REQUESTS_PER_HOUR].at.getTime() + 3_600_000;
    return { outcome: "rate_limited", minutes: Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000)) };
  }
  const [account] = await db().select({ id: s.accounts.id }).from(s.accounts).where(eq(s.accounts.email, email));
  // Earlier codes for this email stop working: only the latest counts.
  await db().update(s.authTokens).set({ usedAt: new Date() })
    .where(and(eq(s.authTokens.email, email), eq(s.authTokens.kind, "code"), isNull(s.authTokens.usedAt)));
  await db().insert(s.authTokens).values({
    accountId: account?.id ?? null, email, kind: "code", tokenHash: sha256(newToken()),
    codeHash: account ? codeHash(email, code) : null, expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    // No account: a code that can never match, so every answer is the same as for a wrong code.
  });
  if (account) await sendMail({ to: email, ...codeEmail(code), kind: "sign_in_code" });
  return { outcome: "sent" };
}

export type CodeOutcome = { ok: true; sessionToken: string; accountId: string }
  | { ok: false; reason: "wrong"; triesLeft: number } | { ok: false; reason: "expired" | "locked" };

// `attach`: the result on screen (id and access token). A right code also adds it to the
// account's history, when it belongs to nobody yet.
export async function verifySignInCode(rawEmail: string, rawCode: string, attach?: { id: string; token: string }): Promise<CodeOutcome> {
  const email = normaliseEmail(rawEmail);
  const code = (rawCode || "").replace(/\D/g, "");
  const [t] = await db().select().from(s.authTokens)
    .where(and(eq(s.authTokens.email, email), eq(s.authTokens.kind, "code"))).orderBy(desc(s.authTokens.createdAt)).limit(1);
  if (!t) return { ok: false, reason: "wrong", triesLeft: CODE_ATTEMPTS - 1 };
  if (t.attempts >= CODE_ATTEMPTS) return { ok: false, reason: "locked" };
  if (t.usedAt) return { ok: false, reason: "expired" };
  if (t.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  if (code.length !== 6 || !t.codeHash || !t.accountId || !sameHash(t.codeHash, codeHash(email, code))) {
    const [after] = await db().update(s.authTokens).set({ attempts: sql`${s.authTokens.attempts} + 1` })
      .where(eq(s.authTokens.id, t.id)).returning({ attempts: s.authTokens.attempts });
    return after.attempts >= CODE_ATTEMPTS ? { ok: false, reason: "locked" } : { ok: false, reason: "wrong", triesLeft: CODE_ATTEMPTS - after.attempts };
  }
  // Single use: only the request that marks it used signs in.
  const [used] = await db().update(s.authTokens).set({ usedAt: new Date() })
    .where(and(eq(s.authTokens.id, t.id), isNull(s.authTokens.usedAt))).returning({ id: s.authTokens.id });
  if (!used) return { ok: false, reason: "expired" };
  if (attach?.id && attach.token) {
    const r = await ownedResult(attach.id, attach.token).catch(() => null);
    if (r && !r.accountId) await db().update(s.results).set({ accountId: t.accountId!, pendingAccountId: null }).where(eq(s.results.id, r.id));
  }
  return { ok: true, accountId: t.accountId!, sessionToken: await signedIn(t.accountId!) };
}

// Signing in claims the results held for the account and opens a session.
async function signedIn(accountId: string): Promise<string> {
  await db().update(s.results).set({ accountId, pendingAccountId: null }).where(eq(s.results.pendingAccountId, accountId));
  await db().update(s.accounts).set({ lastSignInAt: new Date() }).where(eq(s.accounts.id, accountId));
  return createSession(accountId);
}

// PLACEHOLDER copy until supplied (docs/spec.md launch checklist).
export const DELETED_EMAIL = {
  subject: "Your Manager Test account has been deleted",
  body: "Your Manager Test account, score history, reports and goals have been deleted. Your statements were never stored.\n\nThank you for taking the Manager Test.",
};

// Settings → "Yes, delete everything": the confirmation email goes out first (the address
// is gone afterwards), then the account and everything that hangs off it.
export async function deleteAccountWithConfirmation(accountId: string): Promise<void> {
  const [a] = await db().select({ email: s.accounts.email }).from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return;
  await sendMail({ to: a.email, subject: DELETED_EMAIL.subject, text: DELETED_EMAIL.body,
    html: `<p>${DELETED_EMAIL.body.replace(/\n/g, "<br>")}</p>`, kind: "account_deleted" }).catch(() => undefined);
  await deleteAccount(accountId);
}

export async function deleteAccount(accountId: string): Promise<void> {
  await db().delete(s.accounts).where(eq(s.accounts.id, accountId));
}
