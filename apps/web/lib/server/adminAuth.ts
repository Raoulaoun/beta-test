// Admin sign-in: email + password (scrypt), then a 6-digit authenticator code (TOTP, secret
// encrypted with ADMIN_TOTP_KEY). 5 failed attempts per email per 15 minutes locks sign-in.
// Admin sessions: 8 hours, httpOnly, SameSite=Strict, only the token hash stored.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { newToken, sha256 } from "./crypto.ts";
import { readCookie } from "./session.ts";
import { verifyTotp } from "./totp.ts";

export const ADMIN_COOKIE = "mt_admin";
export const ADMIN_SESSION_HOURS = 8;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const PENDING_MINUTES = 5; // between password and code

// ---- password hashing (scrypt) ----
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export function checkPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, "base64");
  const got = scryptSync(password, Buffer.from(saltB64, "base64"), key.length, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(got, key);
}

// ---- TOTP secret encryption (AES-256-GCM) ----
function totpKey(): Buffer {
  const raw = process.env.ADMIN_TOTP_KEY || "";
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ADMIN_TOTP_KEY must be 32 bytes (64 hex characters)");
  return key;
}
export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", totpKey(), iv);
  const enc = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", totpKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export async function createAdmin(email: string, name: string, password: string, totpSecret: string) {
  const [a] = await db().insert(s.adminUsers).values({
    email: email.trim().toLowerCase(), name, passwordHash: hashPassword(password), totpSecretEnc: encryptSecret(totpSecret),
  }).returning();
  return a;
}

async function recentFailures(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.adminLoginAttempts)
    .where(and(eq(s.adminLoginAttempts.email, email), eq(s.adminLoginAttempts.ok, false), gt(s.adminLoginAttempts.createdAt, since)));
  return n;
}
const logAttempt = (email: string, ok: boolean) => db().insert(s.adminLoginAttempts).values({ email, ok });

// Step 1: password. Returns a short-lived pending token for step 2 (stored hashed).
export async function adminPasswordStep(rawEmail: string, password: string): Promise<{ pending: string } | "locked" | "invalid"> {
  const email = rawEmail.trim().toLowerCase();
  if ((await recentFailures(email)) >= MAX_FAILURES) return "locked";
  const [admin] = await db().select().from(s.adminUsers).where(eq(s.adminUsers.email, email));
  const ok = !!admin && checkPassword(password, admin.passwordHash);
  if (!ok) {
    if (!admin) hashPassword(password); // similar timing whether or not the email exists
    await logAttempt(email, false);
    return "invalid";
  }
  const pending = newToken();
  await db().insert(s.adminSessions).values({ adminId: admin.id, tokenHash: sha256(`pending:${pending}`), expiresAt: new Date(Date.now() + PENDING_MINUTES * 60_000) });
  return { pending };
}

// Step 2: authenticator code. Replay of an already used code is refused.
export async function adminCodeStep(pending: string, code: string): Promise<{ session: string } | "locked" | "invalid"> {
  const [row] = await db().select({ session: s.adminSessions, admin: s.adminUsers }).from(s.adminSessions)
    .innerJoin(s.adminUsers, eq(s.adminSessions.adminId, s.adminUsers.id))
    .where(and(eq(s.adminSessions.tokenHash, sha256(`pending:${pending}`)), gt(s.adminSessions.expiresAt, new Date())));
  if (!row) return "invalid";
  const { admin } = row;
  if ((await recentFailures(admin.email)) >= MAX_FAILURES) return "locked";
  const step = verifyTotp(decryptSecret(admin.totpSecretEnc), code.replace(/\s/g, ""));
  if (step === null || (admin.lastTotpStep !== null && step <= admin.lastTotpStep)) {
    await logAttempt(admin.email, false);
    return "invalid";
  }
  await db().update(s.adminUsers).set({ lastTotpStep: step }).where(eq(s.adminUsers.id, admin.id));
  await db().delete(s.adminSessions).where(eq(s.adminSessions.id, row.session.id));
  await logAttempt(admin.email, true);
  const session = newToken();
  await db().insert(s.adminSessions).values({ adminId: admin.id, tokenHash: sha256(session), expiresAt: new Date(Date.now() + ADMIN_SESSION_HOURS * 3_600_000) });
  return { session };
}

export async function adminFromCookie(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, ADMIN_COOKIE);
  if (!token) return null;
  const [row] = await db().select({ admin: s.adminUsers }).from(s.adminSessions)
    .innerJoin(s.adminUsers, eq(s.adminSessions.adminId, s.adminUsers.id))
    .where(and(eq(s.adminSessions.tokenHash, sha256(token)), gt(s.adminSessions.expiresAt, new Date())));
  return row ? { id: row.admin.id, email: row.admin.email, name: row.admin.name } : null;
}

export async function adminSignOut(cookieHeader: string | null) {
  const token = readCookie(cookieHeader, ADMIN_COOKIE);
  if (token) await db().delete(s.adminSessions).where(eq(s.adminSessions.tokenHash, sha256(token)));
}

export function adminCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`;
}

// Mutations must come from our own pages (with SameSite=Strict, a second guard against CSRF).
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host"); } catch { return false; }
}
