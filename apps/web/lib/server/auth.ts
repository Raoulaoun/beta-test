// Email-link sign-in. Tokens: 32 random bytes, only the SHA-256 stored, single use,
// 15 minutes. At most 5 link requests per email per hour. Signing in also claims results
// that were held as pending for this account.
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { newToken, sha256 } from "./crypto.ts";
import { normaliseEmail } from "./leads.ts";
import { sendMail } from "./mailer.ts";
import { createSession } from "./session.ts";
import { knownAccount } from "./known.ts";
import { ownedResult } from "./results.ts";

export const LINK_MINUTES = 15;
export const LINK_REQUESTS_PER_HOUR = 5;

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

export async function issueSignInLink(accountId: string, email: string, minutes = LINK_MINUTES): Promise<string> {
  const token = newToken();
  await db().insert(s.authTokens).values({
    accountId, email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + minutes * 60_000),
  });
  return `${siteUrl()}/auth/verify?token=${token}`;
}

// Copy for this email is not in docs/advice-texts.md yet: placeholder until it is supplied.
export const SIGN_IN_EMAIL = {
  subject: "Your sign-in link",
  body: (link: string) => `Sign in to The Manager Test: ${link}\n\nThis link works once and expires in ${LINK_MINUTES} minutes.`,
};

export type RequestOutcome = "sent" | "rate_limited";

// Same outcome whether or not the email has an account: never reveal who is signed up.
export async function requestSignIn(rawEmail: string): Promise<RequestOutcome> {
  const email = normaliseEmail(rawEmail);
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.authTokens)
    .where(and(eq(s.authTokens.email, email), gt(s.authTokens.createdAt, hourAgo)));
  if (n >= LINK_REQUESTS_PER_HOUR) return "rate_limited";

  const [account] = await db().select({ id: s.accounts.id }).from(s.accounts).where(eq(s.accounts.email, email));
  if (!account) {
    // Count the request for the rate limit, but there is nobody to send to.
    await db().insert(s.authTokens).values({ email, tokenHash: sha256(newToken()), expiresAt: new Date(), usedAt: new Date() });
    return "sent";
  }
  const link = await issueSignInLink(account.id, email);
  const text = SIGN_IN_EMAIL.body(link);
  await sendMail({ to: email, subject: SIGN_IN_EMAIL.subject, text, html: `<p>${text.replace(/\n/g, "<br>").replace(link, `<a href="${link}">${link}</a>`)}</p>`, kind: "sign_in" });
  return "sent";
}

export type VerifyOutcome = { ok: true; sessionToken: string; accountId: string } | { ok: false };

export async function verifySignIn(token: string): Promise<VerifyOutcome> {
  if (!token || token.length > 100) return { ok: false };
  const now = new Date();
  const [row] = await db().update(s.authTokens).set({ usedAt: now })
    .where(and(eq(s.authTokens.tokenHash, sha256(token)), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, now)))
    .returning();
  if (!row?.accountId) return { ok: false };
  await db().update(s.results).set({ accountId: row.accountId, pendingAccountId: null })
    .where(eq(s.results.pendingAccountId, row.accountId));
  await db().update(s.accounts).set({ lastSignInAt: now }).where(eq(s.accounts.id, row.accountId));
  return { ok: true, sessionToken: await createSession(row.accountId), accountId: row.accountId };
}

// "Send me a sign-in link" on the results screen of a known device: the link goes to the
// known account's email, and this browser's current result is held for that account, so it
// joins the history when the link is used.
export async function requestKnownSignIn(cookieHeader: string | null, resultId: string, resultToken: string)
  : Promise<RequestOutcome | "unknown"> {
  const account = await knownAccount(cookieHeader);
  if (!account) return "unknown";
  const result = await ownedResult(resultId, resultToken);
  if (result && !result.accountId) {
    await db().update(s.results).set({ pendingAccountId: account.id }).where(eq(s.results.id, result.id));
  }
  return requestSignIn(account.email);
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
