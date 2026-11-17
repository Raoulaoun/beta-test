// Account sessions: a random token in an httpOnly, Secure, SameSite=Lax cookie; only its
// SHA-256 is stored. 30 days, deleted on sign-out or account deletion.
import { and, eq, gt } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { newToken, sha256 } from "./crypto.ts";

export const SESSION_COOKIE = "mt_session";
export const SESSION_DAYS = 30;

export function readCookie(header: string | null, name: string): string | null {
  for (const part of (header || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export async function createSession(accountId: string): Promise<string> {
  const token = newToken();
  await db().insert(s.sessions).values({
    accountId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export async function sessionAccount(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  const [row] = await db().select({ account: s.accounts }).from(s.sessions)
    .innerJoin(s.accounts, eq(s.sessions.accountId, s.accounts.id))
    .where(and(eq(s.sessions.tokenHash, sha256(token)), gt(s.sessions.expiresAt, new Date())));
  return row?.account ?? null;
}

export async function endSession(cookieHeader: string | null): Promise<void> {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  if (token) await db().delete(s.sessions).where(eq(s.sessions.tokenHash, sha256(token)));
}
