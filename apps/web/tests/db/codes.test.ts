import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { CODE_ATTEMPTS, deleteAccount, requestSignInCode, verifySignInCode } from "../../lib/server/auth.ts";
import { saveResult } from "../../lib/server/results.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";
import { createSession, renewSession, sessionAccount, SESSION_COOKIE } from "../../lib/server/session.ts";
import { outbox } from "../../lib/server/mailer.ts";

beforeEach(async () => { await resetDb(); outbox.length = 0; });
after(closeDb);

async function account(email = "karim@example.com") {
  const [a] = await db().insert(s.accounts).values({ email }).returning();
  return a.id;
}

test("a code signs in once; it is emailed, only its hash is stored", async () => {
  const a = await account();
  assert.deepEqual(await requestSignInCode("Karim@Example.com ", "123456"), { outcome: "sent" });
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, "karim@example.com");
  assert.ok(outbox[0].text.includes("123456") && outbox[0].kind === "sign_in_code");
  assert.equal(outbox[0].subject, "123456 is your Manager Test code", "the design's subject");
  assert.ok(outbox[0].html.includes("Your sign-in code") && outbox[0].html.includes(">123456<") && outbox[0].html.includes("prefers-color-scheme: dark"), "the design's email, light and dark");
  assert.ok(!/href="[^"]*(token|code)=/.test(outbox[0].html), "nothing in the email signs anyone in");
  const rows = await db().select().from(s.authTokens);
  assert.ok(rows.every((r) => !JSON.stringify(r).includes("123456")), "the code itself is never stored");
  const ok = await verifySignInCode("karim@example.com", "123 456");
  assert.ok(ok.ok && ok.accountId === a);
  assert.equal((await sessionAccount(`${SESSION_COOKIE}=${ok.ok && ok.sessionToken}`))?.id, a);
  assert.deepEqual(await verifySignInCode("karim@example.com", "123456"), { ok: false, reason: "expired" }, "single use");
});

test("wrong codes: 'wrong' with the tries left, then locked after 5 tries even with the right code", async () => {
  await account();
  await requestSignInCode("karim@example.com", "111111");
  for (let i = 1; i < CODE_ATTEMPTS; i++) assert.deepEqual(await verifySignInCode("karim@example.com", "000000"), { ok: false, reason: "wrong", triesLeft: CODE_ATTEMPTS - i });
  assert.deepEqual(await verifySignInCode("karim@example.com", "000000"), { ok: false, reason: "locked" });
  assert.deepEqual(await verifySignInCode("karim@example.com", "111111"), { ok: false, reason: "locked" });
});

test("a new code replaces the old one; codes expire after 10 minutes", async () => {
  await account();
  await requestSignInCode("karim@example.com", "111111");
  await requestSignInCode("karim@example.com", "222222");
  assert.equal((await verifySignInCode("karim@example.com", "111111")).ok, false);
  await db().update(s.authTokens).set({ expiresAt: new Date(Date.now() - 1000) });
  assert.deepEqual(await verifySignInCode("karim@example.com", "222222"), { ok: false, reason: "expired" });
});

test("unknown emails: no email sent, and every answer is the same as for a wrong code", async () => {
  assert.deepEqual(await requestSignInCode("nobody@example.com", "123456"), { outcome: "sent" });
  assert.equal(outbox.length, 0);
  assert.deepEqual(await verifySignInCode("nobody@example.com", "123456"), { ok: false, reason: "wrong", triesLeft: 4 });
  for (let i = 2; i < CODE_ATTEMPTS; i++) await verifySignInCode("nobody@example.com", "123456");
  assert.deepEqual(await verifySignInCode("nobody@example.com", "123456"), { ok: false, reason: "locked" }, "locks like a real account");
});

test("at most 5 code requests an hour per email, with the minutes until the next one", async () => {
  await account();
  for (let i = 0; i < 5; i++) assert.deepEqual(await requestSignInCode("karim@example.com"), { outcome: "sent" });
  assert.deepEqual(await requestSignInCode("KARIM@example.com"), { outcome: "rate_limited", minutes: 60 });
  await db().update(s.authTokens).set({ createdAt: new Date(Date.now() - 20 * 60_000) });
  assert.deepEqual(await requestSignInCode("karim@example.com"), { outcome: "rate_limited", minutes: 40 });
  for (let i = 0; i < 5; i++) await requestSignInCode("nobody@example.com");
  assert.equal((await requestSignInCode("nobody@example.com")).outcome, "rate_limited", "unknown emails are limited the same way");
  await db().update(s.authTokens).set({ createdAt: new Date(Date.now() - 3_700_000) });
  assert.deepEqual(await requestSignInCode("karim@example.com"), { outcome: "sent" }, "the window slides");
});

test("the result on screen joins the history with the right code (signed-out banner), only with its token", async () => {
  const a = await account();
  const engine = () => ({ ...structuredClone(DESIGN_FIXTURES.results), account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const } });
  const ctx = { campaign: null, utm: {}, introducedBy: null, device: "Desktop" };
  const one = await saveResult(engine(), ctx), two = await saveResult(engine(), ctx);
  await requestSignInCode("karim@example.com", "444444");
  assert.equal((await verifySignInCode("karim@example.com", "000000", { id: one.id, token: one.accessToken })).ok, false);
  let [r] = await db().select().from(s.results).where(eq(s.results.id, one.id));
  assert.equal(r.accountId, null, "a wrong code attaches nothing");
  assert.ok((await verifySignInCode("karim@example.com", "444444", { id: one.id, token: one.accessToken })).ok);
  [r] = await db().select().from(s.results).where(eq(s.results.id, one.id));
  assert.equal(r.accountId, a);
  await requestSignInCode("karim@example.com", "555555");
  assert.ok((await verifySignInCode("karim@example.com", "555555", { id: two.id, token: "wrong" })).ok);
  [r] = await db().select().from(s.results).where(eq(s.results.id, two.id));
  assert.equal(r.accountId, null, "a wrong result token attaches nothing");
});

test("deleting the account removes it, its results, sessions and codes", async () => {
  const a = await account();
  await requestSignInCode("karim@example.com", "123456");
  const out = await verifySignInCode("karim@example.com", "123456");
  await db().insert(s.results).values({ accountId: a, accessTokenHash: "h", platform: "MT5", scoreType: "full", accountType: "live",
    closedTrades: 50, evaluationDate: "2026-11-17", scoringVersion: "1.2.0", payload: {} });
  await deleteAccount(a);
  for (const t of [s.accounts, s.results, s.sessions]) {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(t);
    assert.equal(n, 0);
  }
  assert.equal(await sessionAccount(`${SESSION_COOKIE}=${out.ok ? out.sessionToken : ""}`), null);
});

test("signing in with a code claims results held for the account", async () => {
  const a = await account();
  const [r] = await db().insert(s.results).values({ accessTokenHash: "x", pendingAccountId: a, platform: "MT5", scoreType: "full",
    accountType: "live", closedTrades: 40, evaluationDate: "2026-11-20", scoringVersion: "1.3.2", payload: {} }).returning();
  await requestSignInCode("karim@example.com", "333333");
  await verifySignInCode("karim@example.com", "333333");
  const [after] = await db().select().from(s.results).where(eq(s.results.id, r.id));
  assert.deepEqual([after.accountId, after.pendingAccountId], [a, null]);
});

test("sessions last a year and are renewed on a visit, at most once a day", async () => {
  const a = await account();
  const token = await createSession(a);
  const cookie = `${SESSION_COOKIE}=${token}`;
  const [sess] = await db().select().from(s.sessions);
  assert.ok(sess.expiresAt.getTime() - Date.now() > 364 * 86_400_000, "a year");
  assert.equal(await renewSession(cookie), null, "fresh session: nothing to renew");
  await db().update(s.sessions).set({ expiresAt: new Date(Date.now() + 200 * 86_400_000) });
  const set = await renewSession(cookie);
  assert.ok(set && /Max-Age=31536000/.test(set) && /HttpOnly/.test(set));
  const [renewed] = await db().select().from(s.sessions);
  assert.ok(renewed.expiresAt.getTime() - Date.now() > 364 * 86_400_000);
});
