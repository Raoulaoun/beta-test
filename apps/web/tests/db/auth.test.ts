import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { deleteAccount, requestSignIn, verifySignIn } from "../../lib/server/auth.ts";
import { outbox } from "../../lib/server/mailer.ts";
import { sessionAccount, SESSION_COOKIE } from "../../lib/server/session.ts";
import { saveResult } from "../../lib/server/results.ts";
import { submitLead } from "../../lib/server/leads.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";

beforeEach(async () => { await resetDb(); outbox.length = 0; });
after(closeDb);

const tokenFrom = (text: string) => /token=([\w-]+)/.exec(text)![1];
async function account(email = "karim@example.com") {
  const [a] = await db().insert(s.accounts).values({ email }).returning();
  return a;
}

test("a sign-in link works once and opens a session", async () => {
  const a = await account();
  assert.equal(await requestSignIn("  Karim@Example.com "), "sent");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, "karim@example.com");
  const token = tokenFrom(outbox[0].text);
  const stored = await db().select().from(s.authTokens);
  assert.ok(stored.every((t) => t.tokenHash !== token), "only the hash is stored");

  const first = await verifySignIn(token);
  assert.ok(first.ok);
  const me = await sessionAccount(`${SESSION_COOKIE}=${first.ok ? first.sessionToken : ""}`);
  assert.equal(me?.id, a.id);
  assert.equal((await verifySignIn(token)).ok, false, "single use");
});

test("expired links don't work", async () => {
  await account();
  await requestSignIn("karim@example.com");
  await db().update(s.authTokens).set({ expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await verifySignIn(tokenFrom(outbox[0].text))).ok, false);
});

test("at most 5 link requests per email per hour, counted even for unknown emails", async () => {
  await account();
  for (let i = 0; i < 5; i++) assert.equal(await requestSignIn("karim@example.com"), "sent");
  assert.equal(await requestSignIn("KARIM@example.com"), "rate_limited");
  for (let i = 0; i < 5; i++) assert.equal(await requestSignIn("nobody@example.com"), "sent");
  assert.equal(await requestSignIn("nobody@example.com"), "rate_limited");
  assert.equal(outbox.filter((m) => m.to === "nobody@example.com").length, 0, "no email for unknown addresses");
  await db().update(s.authTokens).set({ createdAt: new Date(Date.now() - 3_700_000) });
  assert.equal(await requestSignIn("karim@example.com"), "sent", "the window slides");
});

test("signing in claims results held as pending for the account", async () => {
  const engine = () => ({ ...structuredClone(DESIGN_FIXTURES.results), account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const } });
  const ctx = { campaign: null, utm: {}, introducedBy: null, device: "Desktop" };
  const lead = (r: { id: string; accessToken: string }) => ({ result_id: r.id, token: r.accessToken, name: "Karim", email: "karim@example.com",
    cc: "+961", phone: "3 123 456", manage: "No", consent: true, updates: false, remind: false });
  await submitLead(lead(await saveResult(engine(), ctx)), null);
  const later = await saveResult(engine(), ctx);
  await submitLead(lead(later), null);
  let [r] = await db().select().from(s.results).where(eq(s.results.id, later.id));
  assert.equal(r.accountId, null);

  await requestSignIn("karim@example.com");
  const out = await verifySignIn(tokenFrom(outbox[0].text));
  [r] = await db().select().from(s.results).where(eq(s.results.id, later.id));
  assert.equal(r.accountId, out.ok ? out.accountId : "x");
  assert.equal(r.pendingAccountId, null);
});

test("deleting the account removes it, its results and its sessions", async () => {
  const a = await account();
  await requestSignIn(a.email);
  const out = await verifySignIn(tokenFrom(outbox[0].text));
  await db().insert(s.results).values({ accountId: a.id, accessTokenHash: "h", platform: "MT5", scoreType: "full", accountType: "live",
    closedTrades: 50, evaluationDate: "2026-11-17", scoringVersion: "1.2.0", payload: {} });
  await deleteAccount(a.id);
  for (const t of [s.accounts, s.results, s.sessions, s.authTokens]) {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(t);
    assert.equal(n, 0);
  }
  assert.equal(await sessionAccount(`${SESSION_COOKIE}=${out.ok ? out.sessionToken : ""}`), null);
});
