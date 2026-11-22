import { test } from "node:test";
import assert from "node:assert/strict";
import { accountMeta, chart, deltaLabel, initials, longDate, ringDash, starterLine, type HistoryItem } from "../../lib/accountView.ts";

const item = (date: string, score: number | null, o: Partial<HistoryItem> = {}): HistoryItem => ({
  id: date, evaluation_date: date, created_at: date + "T10:00:00Z", score_type: "full", early: false, on_chart: score !== null,
  score, band: { code: "building", name: "Building" }, pillars: [], period: "14 months", closed_trades: 1186, coach: { working: [], costing: [] }, ...o,
});

test("dates, initials, meta and delta as the design shows them", () => {
  assert.equal(longDate("2026-11-16"), "16 Nov 2026");
  assert.equal(initials("Karim Haddad", "k@x.y"), "KH");
  assert.equal(initials(null, "karim@x.y"), "K");
  assert.equal(accountMeta(item("2026-11-16", 67), "live"), "Live account · 14 months · 1,186 trades");
  assert.equal(deltaLabel({ kind: "delta", score: { delta: 6 } }), "+6 since your last upload");
  assert.equal(deltaLabel({ kind: "delta", score: { delta: -3 } }), "-3 since your last upload");
  assert.equal(deltaLabel({ kind: "first_full" }), "");
  assert.equal(ringDash(50).split(" ")[0], (Math.PI * 88).toFixed(1));
  assert.deepEqual(starterLine(item("2026-02-02", null, { score_type: "starter", closed_trades: 3 })),
    { title: "2 Feb 2026 · Starter read", body: "3 closed trades. No score yet, so it isn't on the chart." });
});

test("chart: oldest first, design scale 40–80, widened in steps of 20 when a score falls outside", () => {
  const c = chart([item("2026-11-16", 67), item("2026-09-15", 61, { early: true, score_type: "early" }), item("2026-02-02", null, { score_type: "starter" })]);
  assert.deepEqual(c.points.map((p) => p.score), [61, 67]);
  assert.deepEqual(c.ticks.map((t) => t.v), [80, 60, 40]);
  assert.deepEqual([c.points[0].tx, c.points[1].tx], ["-10%", "-90%"]);
  assert.ok(c.linePtsEarly.length > 0, "dashed line from the early score to the first full one");
  const wide = chart([item("2026-11-16", 88), item("2026-09-15", 32)]);
  assert.deepEqual(wide.ticks.map((t) => t.v), [100, 80, 60, 40, 20]);
  assert.ok(wide.points.every((p) => p.y >= 0 && p.y <= 100));
});

test("chart: two results in the same month are labelled by day", () => {
  const c = chart([item("2026-11-20", 67), item("2026-11-03", 61)]);
  assert.deepEqual(c.points.map((p) => p.short), ["3 Nov", "20 Nov"]);
});
