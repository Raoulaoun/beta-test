import { test } from "node:test";
import assert from "node:assert/strict";
import { chips, dash, errorScreen, longDate, panelView, pillarRows, precheck, shortProgress, CAP_NOTE } from "../../lib/view.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";
import type { ScoreResult } from "../../lib/types.ts";

const r = DESIGN_FIXTURES.results;

test("browser checks follow the design's order", () => {
  assert.equal(precheck({ name: "a.xlsx", size: 11 * 1024 * 1024 }), "toolarge");
  assert.equal(precheck({ name: "ReportHistory-MT4.htm", size: 10 }), "mt4");
  assert.equal(precheck({ name: "photo.png", size: 10 }), "notstatement");
  assert.equal(precheck({ name: "a.xlsx", size: 0 }), "empty");
  assert.equal(precheck({ name: "ReportHistory.html", size: 10 }), null);
});

test("service error codes map to design error screens", () => {
  assert.equal(errorScreen("mt4_file"), "mt4");
  assert.equal(errorScreen("empty_report"), "empty");
  assert.equal(errorScreen("file_too_large"), "toolarge");
  assert.equal(errorScreen("not_a_report"), "notstatement");
});

test("chips match the design and switch to Demo account", () => {
  assert.deepEqual(chips(r), ["Live account", "14 months", "186 trades"]);
  const demo: ScoreResult = { ...r, account: { ...r.account, account_type: "demo" } };
  assert.equal(chips(demo)[0], "Demo account");
});

test("dial, pillars, dates and short-history bars match the design's sample", () => {
  assert.equal(dash(67), "370.5 552.9");
  assert.deepEqual(pillarRows(r.pillars!)[0], { name: "Risk control", pct: "25%", score: 74, w: "74%" });
  assert.equal(pillarRows([{ key: "x", name: "X", weight: 0.2, score: 99.5 }])[0].score, 100);
  assert.equal(longDate("2027-03-14"), "14 March 2027");
  assert.deepEqual(shortProgress(DESIGN_FIXTURES.short).map((p) => [p.value, p.w]), [["2 of 3", "67%"], ["21 of 30", "70%"]]);
});

test("red-flag panel: one row per flag, cap note once, summary from the engine", () => {
  assert.deepEqual(panelView(r.red_flag_panel), { kind: "none" });
  const v = panelView({ none: false, none_text: null, summary: "3 red flags found. Your score is capped at 30.", cap_applied: 30,
    rows: [{ code: "martingale", text: "m", cap: 40 }, { code: "blown_account", text: "b", cap: 30 }, { code: "no_stops", text: "n", cap: null }] });
  assert.equal(v.kind, "flags");
  if (v.kind === "flags") {
    assert.equal(v.summary, "3 red flags found. Your score is capped at 30.");
    assert.deepEqual(v.rows.map((x) => [x.capping, x.showCapNote]), [[true, true], [true, false], [false, false]]);
  }
  assert.ok(CAP_NOTE.startsWith("Martingale, grid trading"));
});
