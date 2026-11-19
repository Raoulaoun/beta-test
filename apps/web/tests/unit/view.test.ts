import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chips, starterChips, dash, errorCopy, errorScreen, isFileError, nudgeParts, panelView, pillarRows, precheck, progressRows, COPY, ERROR_LINES, CAP_NOTE } from "../../lib/view.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";
import type { ScoreResult } from "../../lib/types.ts";

const r = DESIGN_FIXTURES.results;
const DOC = readFileSync(new URL("../../../../docs/advice-texts.md", import.meta.url), "utf8");
const docRows = Object.fromEntries([...DOC.matchAll(/^\| (.+?) \| (.+?) \|$/gm)].map((m) => [m[1], m[2]]));

test("browser checks: size, extension, empty; MT4 files are allowed", () => {
  assert.equal(precheck({ name: "a.xlsx", size: 11 * 1024 * 1024 }), "toolarge");
  assert.equal(precheck({ name: "DetailedStatement-MT4.htm", size: 10 }), null);
  assert.equal(precheck({ name: "photo.png", size: 10 }), "notstatement");
  assert.equal(precheck({ name: "a.xlsx", size: 0 }), "empty");
  assert.equal(precheck({ name: "ReportHistory.html", size: 10 }), null);
});

test("only real parse problems map to file messages", () => {
  assert.equal(errorScreen(422, "empty_report"), "empty");
  assert.equal(errorScreen(422, "not_a_report"), "notstatement");
  assert.equal(errorScreen(413, "file_too_large"), "toolarge");
  assert.equal(errorScreen(422, "mt4_file"), "server"); // retired code: never a file message
});

test("service failures never blame the file", () => {
  for (const [status, code] of [[502, "scoring_unavailable"], [500, "scoring_failed"], [503, undefined], [504, undefined],
    [undefined, undefined], [422, "something_new"], [400, "not_a_report"]] as const) {
    const key = errorScreen(status, code);
    assert.equal(key, "server", `${status} ${code}`);
    assert.equal(isFileError(key), false);
  }
  assert.equal(errorScreen(429, undefined), "ratelimit");
});

test("error lines match docs/advice-texts.md word for word, split into title and body", () => {
  const cases: Record<string, keyof typeof ERROR_LINES> = {
    "Not a report": "notstatement", "Empty report": "empty", "File too large": "toolarge",
    "Too many uploads": "ratelimit", "Server error": "server",
  };
  for (const [docCase, key] of Object.entries(cases)) {
    assert.equal(ERROR_LINES[key], docRows[docCase], docCase);
    const [title, body] = errorCopy(key);
    assert.equal([title, body].filter(Boolean).join(" "), docRows[docCase]);
  }
  assert.deepEqual(errorCopy("notstatement"), ["We couldn't read this file.", "Upload the statement exported from MT4 or MT5. The guide below shows how."]);
});

test("landing, retest and MT4-step copy match the docs", () => {
  assert.equal(COPY.dropMain, docRows["Upload box, main line"]);
  assert.equal(COPY.dropFormats, docRows["Upload box, formats line"]);
  assert.equal(COPY.landingSubline, docRows["Landing subline"]);
  assert.equal(COPY.retest, docRows["Retest checkbox"]);
  COPY.mt4Steps.forEach((step, i) => assert.ok(DOC.includes(`${i + 1}. ${step}`), step));
});

test("chips match the design and switch to Demo account", () => {
  assert.deepEqual(chips(r), ["Live account", "14 months", "186 trades"]);
  const demo: ScoreResult = { ...r, account: { ...r.account, account_type: "demo" } };
  assert.equal(chips(demo)[0], "Demo account");
  const twoWeeks = { ...r, history: { months: 0.46, closed_trades: 10 }, period: { ...r.period, days: 14, label: "2 weeks" } };
  assert.equal(chips(twoWeeks)[1], "2 weeks", "a short export shows weeks, never 0 months");
  const many = { ...r, history: { months: 0.03, closed_trades: 9711 } };
  assert.equal(chips(many)[2], "9,711 trades", "thousand separators");
});

test("starter reads drop the months chip", () => {
  assert.deepEqual(starterChips(DESIGN_FIXTURES.starter), ["Live account", "3 trades"]);
});

test("dial, pillars and progress bars", () => {
  assert.equal(dash(67), "370.5 552.9");
  assert.deepEqual(pillarRows(r.pillars!)[0], { name: "Risk control", pct: "25%", score: 74, w: "74%" });
  assert.deepEqual(progressRows(DESIGN_FIXTURES.early).map((p) => [p.label, p.value, p.w]),
    [["Months of history", "2 of 3", "67%"], ["Closed trades", "21 of 30", "70%"]]);
  assert.deepEqual(progressRows(r), []);
});

test("the nudge links only its last sentence", () => {
  const text = "Your file only covers 2 weeks. Did you choose All History? Export again for a more accurate score.";
  assert.deepEqual(nudgeParts(text), ["Your file only covers 2 weeks. Did you choose All History? ", "Export again for a more accurate score."]);
});

test("red-flag panel: one row per flag, cap note once, summary from the engine", () => {
  assert.deepEqual(panelView(r.red_flag_panel), { kind: "none" });
  const v = panelView({ none: false, none_text: null, summary: "3 red flags found. Your score is capped at 30.", cap_applied: 30,
    rows: [{ code: "martingale", text: "m", cap: 40 }, { code: "blown_account", text: "b", cap: 30 }, { code: "no_stops", text: "n", cap: null }] });
  assert.equal(v.kind, "flags");
  if (v.kind === "flags") {
    assert.deepEqual(v.rows.map((x) => [x.capping, x.showCapNote]), [[true, true], [true, false], [false, false]]);
  }
  assert.ok(CAP_NOTE.startsWith("Martingale, grid trading"));
});
