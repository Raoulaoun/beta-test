// Known device: a browser that signed in to, or created, an account. Lets the results screen
// say "You already have a Manager Test account" and send a sign-in link to that account's
// email without the browser ever holding the email. Random token in an httpOnly cookie;
// only its SHA-256 is stored. Never set for a lead that used someone else's email.
import { and, eq, gt } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { newToken, sha256 } from "./crypto.ts";
import { readCookie } from "./session.ts";

export const KNOWN_COOKIE = "mt_known";
export const KNOWN_DAYS = 365;

export function knownCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${KNOWN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${KNOWN_DAYS * 86_400}${secure}`;
}

export async function rememberDevice(accountId: string): Promise<string> {
  const token = newToken();
  await db().insert(s.knownDevices).values({
    accountId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + KNOWN_DAYS * 86_400_000),
  });
  return token;
}

export async function knownAccount(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, KNOWN_COOKIE);
  if (!token) return null;
  const [row] = await db().select({ account: s.accounts }).from(s.knownDevices)
    .innerJoin(s.accounts, eq(s.knownDevices.accountId, s.accounts.id))
    .where(and(eq(s.knownDevices.tokenHash, sha256(token)), gt(s.knownDevices.expiresAt, new Date())));
  return row?.account ?? null;
}
