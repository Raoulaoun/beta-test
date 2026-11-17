import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";

beforeEach(resetDb);
after(closeDb);

function result(accountId: string | null, extra: Partial<typeof s.results.$inferInsert> = {}) {
  return {
    accountId, accessTokenHash: "h".repeat(64), platform: "MT5", scoreType: "full" as const, score: 70,
    accountType: "live", closedTrades: 120, evaluationDate: "2026-11-17", scoringVersion: "1.2.0",
    payload: {}, ...extra,
  };
}

test("an account holds many results, each with evaluation date and scoring version", async () => {
  const [a] = await db().insert(s.accounts).values({ email: "a@example.com" }).returning();
  await db().insert(s.results).values([result(a.id, { evaluationDate: "2026-09-01" }), result(a.id), result(a.id, { scoringVersion: "1.1.0" })]);
  const rows = await db().select().from(s.results).where(eq(s.results.accountId, a.id));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.evaluationDate && r.scoringVersion));
});

test("deleting an account deletes its results, insights, goals, CRM data, tokens and sessions", async () => {
  const [a] = await db().insert(s.accounts).values({ email: "gone@example.com" }).returning();
  const [r] = await db().insert(s.results).values(result(a.id)).returning();
  await db().insert(s.resultInsights).values({ resultId: r.id, area: "session", segment: "London", polarity: "working", rank: 1 });
  await db().insert(s.goals).values({ accountId: a.id, kind: "pillar", pillar: "discipline", target: 68, baselineResultId: r.id });
  await db().insert(s.crm).values({ accountId: a.id });
  await db().insert(s.crmNotes).values({ accountId: a.id, author: "Raoul", body: "note" });
  await db().insert(s.emailLog).values({ accountId: a.id, kind: "report", status: "sent" });
  await db().insert(s.authTokens).values({ accountId: a.id, email: a.email, tokenHash: "t1", expiresAt: new Date() });
  await db().insert(s.sessions).values({ accountId: a.id, tokenHash: "s1", expiresAt: new Date() });
  await db().insert(s.funnelEvents).values({ kind: "lead_submitted", resultId: r.id });

  await db().delete(s.accounts).where(eq(s.accounts.id, a.id));

  for (const t of [s.results, s.resultInsights, s.goals, s.crm, s.crmNotes, s.emailLog, s.authTokens, s.sessions]) {
    const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(t);
    assert.equal(n, 0);
  }
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.funnelEvents);
  assert.equal(n, 1, "anonymous funnel counts are kept");
});

test("one active goal per account", async () => {
  const [a] = await db().insert(s.accounts).values({ email: "g@example.com" }).returning();
  await db().insert(s.goals).values({ accountId: a.id, kind: "band", band: "emerging_manager" });
  await assert.rejects(db().insert(s.goals).values({ accountId: a.id, kind: "pillar", pillar: "risk_control", target: 80 }));
  await db().insert(s.goals).values({ accountId: a.id, kind: "pillar", pillar: "risk_control", target: 80, active: false });
});

test("emails are unique", async () => {
  await db().insert(s.accounts).values({ email: "dup@example.com" });
  await assert.rejects(db().insert(s.accounts).values({ email: "dup@example.com" }));
});

test("results can be anonymous and carry a source for version 2", async () => {
  const [r] = await db().insert(s.results).values(result(null)).returning();
  assert.equal(r.accountId, null);
  assert.equal(r.source, "upload");
  const [c] = await db().insert(s.results).values(result(null, { source: "connected" })).returning();
  assert.equal(c.source, "connected");
});

test("no column could hold an account number", async () => {
  const cols = await db().execute(sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`);
  const names = cols.rows.map((r) => `${r.table_name}.${r.column_name}`);
  assert.ok(!names.some((n) => /account_(number|no|login)|\.login$/.test(n)), names.join(", "));
});
