import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { CODE_ATTEMPTS, requestSignInCode, verifySignInCode } from "../../lib/server/auth.ts";
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
  assert.equal(await requestSignInCode("Karim@Example.com ", "123456"), "sent");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, "karim@example.com");
  assert.ok(outbox[0].text.includes("123456") && outbox[0].kind === "sign_in_code");
  const rows = await db().select().from(s.authTokens);
  assert.ok(rows.every((r) => !JSON.stringify(r).includes("123456")), "the code itself is never stored");
  const ok = await verifySignInCode("karim@example.com", "123 456");
  assert.ok(ok.ok && ok.accountId === a);
  assert.equal((await sessionAccount(`${SESSION_COOKIE}=${ok.ok && ok.sessionToken}`))?.id, a);
  assert.deepEqual(await verifySignInCode("karim@example.com", "123456"), { ok: false, reason: "expired" }, "single use");
});

test("wrong codes: 'wrong', then locked after 5 tries even with the right code", async () => {
  await account();
  await requestSignInCode("karim@example.com", "111111");
  for (let i = 1; i < CODE_ATTEMPTS; i++) assert.deepEqual(await verifySignInCode("karim@example.com", "000000"), { ok: false, reason: "wrong" });
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
  assert.equal(await requestSignInCode("nobody@example.com", "123456"), "sent");
  assert.equal(outbox.length, 0);
  assert.deepEqual(await verifySignInCode("nobody@example.com", "123456"), { ok: false, reason: "wrong" });
  for (let i = 2; i < CODE_ATTEMPTS; i++) await verifySignInCode("nobody@example.com", "123456");
  assert.deepEqual(await verifySignInCode("nobody@example.com", "123456"), { ok: false, reason: "locked" }, "locks like a real account");
});

test("at most 5 code requests an hour per email", async () => {
  await account();
  for (let i = 0; i < 5; i++) assert.equal(await requestSignInCode("karim@example.com"), "sent");
  assert.equal(await requestSignInCode("karim@example.com"), "rate_limited");
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
