import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { deleteStaleDropoffs, recordProgress, reopenResult, saveResult } from "../../lib/server/results.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";

beforeEach(resetDb);
after(closeDb);

const engineResult = () => ({
  ...structuredClone(DESIGN_FIXTURES.results),
  account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const, account_masked: "•••567", fingerprint: "f".repeat(64) },
});
const ctx = { campaign: "ig-2347", utm: { utm_source: "ig", utm_campaign: "ig-2347" }, introducedBy: "INTRO7", device: "iPhone" };

test("saving keeps the result, never the masked number; fingerprint sits in its own column", async () => {
  const { id, accessToken } = await saveResult(engineResult(), ctx);
  const [row] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.equal(row.accountId, null);
  assert.equal(row.accountFingerprint, "f".repeat(64));
  assert.equal(row.score, 67);
  assert.equal(row.scoringVersion, "1.0.0");
  assert.equal(row.evaluationDate, "2026-11-16");
  assert.equal(row.campaign, "ig-2347");
  assert.notEqual(row.accessTokenHash, accessToken, "only the token's hash is stored");
  const blob = JSON.stringify(row.payload);
  assert.ok(!blob.includes("•••567") && !blob.includes("fingerprint"));
});

test("the uploading browser can reopen its result with the token, nobody else can", async () => {
  const { id, accessToken } = await saveResult(engineResult(), ctx);
  const ok = await reopenResult(id, accessToken);
  assert.equal(ok?.payload.score, 67);
  assert.equal(await reopenResult(id, "wrong-token"), null);
  assert.equal(await reopenResult("not-a-uuid", accessToken), null);
});

test("saved results expire for the browser after 30 days", async () => {
  const { id, accessToken } = await saveResult(engineResult(), ctx);
  await db().update(s.results).set({ createdAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(s.results.id, id));
  assert.equal(await reopenResult(id, accessToken), null);
});

test("left-at only moves forward; the exit prompt is counted once", async () => {
  const { id, accessToken } = await saveResult(engineResult(), ctx);
  await recordProgress(id, accessToken, "lead_form");
  await recordProgress(id, accessToken, "pillars");
  let [row] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.equal(row.leftAt, "lead_form");
  await recordProgress(id, accessToken, "exit_prompt");
  await recordProgress(id, accessToken, "exit_prompt");
  [row] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.equal(row.leftAt, "exit_prompt");
  assert.equal(row.exitPromptShown, true);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.funnelEvents).where(eq(s.funnelEvents.kind, "exit_prompt_shown"));
  assert.equal(n, 1);
});

test("anonymous results without a lead are deleted after 90 days; leads and recent ones stay", async () => {
  const old = await saveResult(engineResult(), ctx);
  const recent = await saveResult(engineResult(), ctx);
  const [a] = await db().insert(s.accounts).values({ email: "lead@example.com" }).returning();
  const lead = await saveResult(engineResult(), { ...ctx, accountId: a.id });
  const ago = new Date(Date.now() - 91 * 86_400_000);
  await db().update(s.results).set({ createdAt: ago }).where(sql`${s.results.id} in (${old.id}, ${lead.id})`);
  await db().insert(s.funnelEvents).values({ kind: "score_shown", resultId: old.id });

  assert.equal(await deleteStaleDropoffs(), 1);
  const ids = (await db().select({ id: s.results.id }).from(s.results)).map((r) => r.id).sort();
  assert.deepEqual(ids, [recent.id, lead.id].sort());
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.funnelEvents);
  assert.equal(n, 1, "funnel counts are kept");
});

test("coach: every finding is stored as an aggregate; the payload keeps only the free top 1 + 1", async () => {
  const f = (area: string, polarity: "working" | "costing", rank: number, segment: string | null) => ({
    area, polarity, segment, trades: 24, share: polarity === "costing" ? 0.35 : 0.4, pf_without: polarity === "costing" ? 1.6 : null,
    impact: 0.35, rank, text: `${area} ${polarity}`, action: polarity === "costing" ? "Do less of it." : null, data: { net: -120.5 },
  });
  const findings = [f("Day of week", "costing", 1, "Monday"), f("Instrument", "costing", 2, "XAUUSD"),
    f("Session", "working", 1, "London"), f("Direction", "working", 2, "long")];
  const r = { ...engineResult(), coach: { findings, top: { working: findings[2], costing: findings[0] } } };
  const { id } = await saveResult(r, ctx);
  const rows = await db().select().from(s.resultInsights).where(eq(s.resultInsights.resultId, id));
  assert.equal(rows.length, 4, "all qualifying findings stored");
  const mon = rows.find((x) => x.segment === "Monday")!;
  assert.equal(mon.polarity, "costing"); assert.equal(mon.rank, 1); assert.equal(Number(mon.share), 0.35); assert.equal(Number(mon.pfWithout), 1.6);
  assert.deepEqual(Object.keys(mon.data as object).sort(), ["action", "impact", "net", "text"]);
  const [row] = await db().select().from(s.results).where(eq(s.results.id, id));
  const coach = (row.payload as { coach: Record<string, unknown> }).coach;
  assert.deepEqual(Object.keys(coach), ["top"], "payload holds the free top only");
  await db().delete(s.results).where(eq(s.results.id, id));
  assert.equal((await db().select().from(s.resultInsights).where(eq(s.resultInsights.resultId, id))).length, 0, "insights go with the result");
});

test("starter read (no coach) stores no insights", async () => {
  const { id } = await saveResult({ ...engineResult(), coach: null }, ctx);
  assert.equal((await db().select().from(s.resultInsights).where(eq(s.resultInsights.resultId, id))).length, 0);
});
