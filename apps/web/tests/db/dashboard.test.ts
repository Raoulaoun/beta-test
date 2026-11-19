import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { saveResult } from "../../lib/server/results.ts";
import { dashboard } from "../../lib/server/dashboard.ts";
import { acceptSuggested, changeGoal, goalView, refreshGoals } from "../../lib/server/goals.ts";
import { getSettings, updateSettings } from "../../lib/server/accountSettings.ts";
import { knownAccount, KNOWN_COOKIE, rememberDevice } from "../../lib/server/known.ts";
import { deleteAccount, deleteAccountWithConfirmation, requestKnownSignIn, verifySignIn } from "../../lib/server/auth.ts";
import { outbox } from "../../lib/server/mailer.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";

beforeEach(async () => { await resetDb(); outbox.length = 0; });
after(closeDb);

const ctx = { campaign: null, utm: {}, introducedBy: null, device: "Desktop" };
const BAND = (score: number) => score >= 80 ? { code: "professional_grade", name: "Professional Grade" }
  : score >= 60 ? { code: "emerging_manager", name: "Emerging Manager" } : score >= 40 ? { code: "building", name: "Building" }
  : { code: "developing", name: "Developing" };

type P = { risk_control: number; discipline: number; consistency: number; risk_adjusted: number; depth: number };
const base: P = { risk_control: 74, discipline: 58, consistency: 71, risk_adjusted: 66, depth: 30 };
let clock = Date.parse("2026-06-01T10:00:00Z");

async function account(email = "karim@example.com") {
  const [a] = await db().insert(s.accounts).values({ email }).returning();
  return a.id;
}

async function add(accountId: string | null, o: { type?: "full" | "early" | "starter"; score?: number | null; pillars?: Partial<P>;
  fp?: string | null; flags?: string[]; findings?: number } = {}) {
  const f = structuredClone(DESIGN_FIXTURES.results);
  const type = o.type ?? "full";
  const score = type === "starter" ? null : (o.score ?? 67);
  const p = { ...base, ...o.pillars };
  const findings = Array.from({ length: o.findings ?? 0 }, (_, i) => ({
    area: "Day of week", polarity: (i % 2 ? "working" : "costing") as "working" | "costing", segment: `Seg ${i}`, trades: 20,
    share: 0.3, pf_without: null, impact: 0.3, rank: Math.floor(i / 2) + 1, text: `line ${i}`, action: i % 2 ? null : "act", data: {},
  }));
  const r = {
    ...f, score_type: type, score, band: score === null ? null : { ...BAND(score), meaning: "" },
    pillars: type === "starter" ? null : (Object.keys(p) as (keyof P)[]).map((key) => ({ key, name: key, weight: 0.2, score: p[key] })),
    red_flags: (o.flags ?? []).map((code) => ({ code, text: code })),
    account: { ...f.account, platform: "MT5" as const, fingerprint: o.fp === undefined ? "fp-A" : o.fp },
    coach: findings.length ? { findings, top: { working: null, costing: null } } : null,
  };
  const { id } = await saveResult(r as never, { ...ctx, accountId });
  clock += 86_400_000;
  await db().update(s.results).set({ createdAt: new Date(clock) }).where(eq(s.results.id, id));
  return id;
}

// ---------- history ----------

test("history: grouped by trading account, newest group first and default; early marked; starter off the chart", async () => {
  const a = await account();
  await add(a, { fp: "fp-A", type: "early", score: 55 });
  await add(a, { fp: "fp-A", type: "starter" });
  await add(a, { fp: "fp-B", score: 70 });
  await add(a, { fp: "fp-A", score: 72 });
  const d = await dashboard(a);
  assert.deepEqual(d.trading_accounts.map((g) => g.key), ["fp-A", "fp-B"]);
  assert.equal(d.default_trading_account, "fp-A");
  const A = d.trading_accounts[0].results;
  assert.deepEqual(A.map((r) => r.score_type), ["full", "starter", "early"], "newest first");
  assert.deepEqual(A.map((r) => r.on_chart), [true, false, true]);
  assert.deepEqual(A.map((r) => r.early), [false, false, true]);
  assert.ok(A.every((r) => r.scoring_version && r.evaluation_date));
});

test("history: full coach findings, working and costing in rank order", async () => {
  const a = await account();
  await add(a, { findings: 6 });
  const [r] = (await dashboard(a)).trading_accounts[0].results;
  assert.equal(r.coach.working.length, 3);
  assert.equal(r.coach.costing.length, 3);
  assert.deepEqual(r.coach.costing.map((f) => f.rank), [1, 2, 3]);
  assert.ok(r.coach.costing.every((f) => f.action === "act"));
});

test("history: only this account's results; results without a trading account ID form their own group", async () => {
  const a = await account(), b = await account("other@example.com");
  await add(a, { fp: null });
  await add(b);
  await add(null);
  const d = await dashboard(a);
  assert.deepEqual(d.trading_accounts.map((g) => [g.key, g.results.length]), [["unidentified", 1]]);
});

// ---------- since your last result ----------

test("since last: same score type only, with score, pillar and flag changes", async () => {
  const a = await account();
  await add(a, { score: 60, pillars: { discipline: 50 }, flags: ["no_stops", "grid"] });
  await add(a, { type: "early", score: 50 });
  await add(a, { score: 67, pillars: { discipline: 61 }, flags: ["grid", "martingale"] });
  const s1 = (await dashboard(a)).trading_accounts[0].since_last;
  assert.equal(s1.kind, "delta");
  if (s1.kind !== "delta") return;
  assert.deepEqual(s1.score, { from: 60, to: 67, delta: 7 }, "compared with the previous full, not the early");
  assert.deepEqual(s1.pillars.find((p) => p.key === "discipline"), { key: "discipline", name: "Discipline", from: 50, to: 61, delta: 11 });
  assert.deepEqual(s1.flags_resolved, ["no_stops"]);
  assert.deepEqual(s1.flags_new, ["martingale"]);
});

test("since last: early scores then the first full → 'Your first full score', no delta", async () => {
  const a = await account();
  await add(a, { type: "early", score: 55 });
  await add(a, { type: "early", score: 62 });
  await add(a, { score: 74 });
  assert.deepEqual((await dashboard(a)).trading_accounts[0].since_last, { kind: "first_full" });
});

test("since last: early compares with the previous early; a single result or a starter read has none", async () => {
  const a = await account();
  await add(a, { type: "early", score: 52 });
  await add(a, { score: 70 });
  await add(a, { type: "early", score: 58 });
  const s1 = (await dashboard(a)).trading_accounts[0].since_last;
  assert.equal(s1.kind === "delta" && s1.score.from, 52);
  const b = await account("b@example.com");
  await add(b);
  assert.equal((await dashboard(b)).trading_accounts[0].since_last.kind, "none");
  await add(b, { type: "starter" });
  assert.equal((await dashboard(b)).trading_accounts[0].since_last.kind, "none");
});

// ---------- goals ----------

test("goal: set automatically to the lowest pillar + 10 (track record depth included)", async () => {
  const a = await account();
  assert.equal(await refreshGoals(a), null, "no scored result, no goal");
  await add(a, { type: "starter" });
  assert.equal(await refreshGoals(a), null, "a starter read sets no goal");
  await add(a, { pillars: { discipline: 58, depth: 30 } });
  const v = await goalView(a);
  assert.equal(v.state, "auto");
  assert.deepEqual(v.goal && { t: v.goal.title, f: v.goal.fromLabel, n: v.goal.nowLabel, to: v.goal.toLabel, note: v.goal.note },
    { t: "Track record depth from 30 to 40", f: "Started at 30", n: "30 now", to: "Goal 40", note: "We picked your lowest pillar. You can change it any time." });
  await refreshGoals(a);
  assert.equal((await db().select().from(s.goals).where(eq(s.goals.accountId, a))).length, 1, "idempotent: still one goal");
});

test("goal: change to any pillar with the design's targets, or a band above; other values refused", async () => {
  const a = await account();
  await add(a, { score: 55, pillars: { discipline: 47 } });
  const v = await goalView(a);
  const disc = v.options!.pillars.find((p) => p.key === "discipline")!;
  assert.deepEqual(disc.targets, [55, 60, 65, 70], "current 47: +5..+20 rounded up to 5");
  assert.deepEqual(v.options!.bands.map((b) => b.code), ["emerging_manager", "professional_grade"]);
  assert.equal(await changeGoal(a, { kind: "pillar", pillar: "discipline", target: 68 }), null, "not an offered target");
  assert.equal(await changeGoal(a, { kind: "band", band: "building" }), null, "not above the current score");
  await changeGoal(a, { kind: "pillar", pillar: "discipline", target: 70 });
  const after = await goalView(a);
  assert.equal(after.state, "active");
  assert.equal(after.goal?.title, "Discipline from 47 to 70");
  assert.equal(after.goal?.note, "23 points to go.");
  assert.equal((await db().select().from(s.goals).where(eq(s.goals.active, true))).length, 1, "one active goal");
});

test("goal: the biggest lever comes from a costing note in that pillar", async () => {
  const a = await account();
  await add(a, { pillars: { discipline: 47 } });
  await changeGoal(a, { kind: "pillar", pillar: "discipline", target: 70 });
  const v = await goalView(a, [{ area: "Day of week", action: "Cut size by half on Monday until the pattern changes." },
    { area: "After a loss", action: "Stop for the session after 2 losses in a row." }]);
  assert.equal(v.goal?.note, "23 points to go. Your biggest lever: stop for the session after 2 losses in a row.");
});

test("goal: reached → done with that result, next suggested until set; 'Set as my next goal' makes it active", async () => {
  const a = await account();
  await add(a, { pillars: { discipline: 47, depth: 90 } });
  await changeGoal(a, { kind: "pillar", pillar: "discipline", target: 70 });
  await add(a, { pillars: { discipline: 64, depth: 90 } });
  assert.equal((await goalView(a)).state, "active", "64 is not 70 yet");
  const hit = await add(a, { pillars: { discipline: 71, risk_adjusted: 61, depth: 90 } });
  const v = await goalView(a);
  assert.equal(v.state, "reached");
  assert.equal(v.reached?.title, "Goal reached: Discipline 70");
  assert.match(v.reached!.line, /^Up from 47 when you set it in [A-Z][a-z]+( \d{4})?\.$/);
  assert.equal(v.next?.title, "Risk-adjusted return from 61 to 71");
  const [done] = await db().select().from(s.goals).where(eq(s.goals.achievedResultId, hit));
  assert.ok(done && !done.active && done.achievedAt);
  assert.equal(await acceptSuggested(a), true);
  assert.equal((await goalView(a)).state, "active");
});

test("goal: band goal reached when the overall score reaches the band", async () => {
  const a = await account();
  await add(a, { score: 55 });
  await changeGoal(a, { kind: "band", band: "emerging_manager" });
  const v = await goalView(a);
  assert.deepEqual(v.goal && [v.goal.title, v.goal.toLabel, v.goal.note], ["Reach Emerging Manager", "Emerging Manager at 60", "5 points to go on your overall score."]);
  await add(a, { score: 61 });
  const after = await goalView(a);
  assert.equal(after.state, "reached");
  assert.equal(after.reached?.title, "Goal reached: Emerging Manager");
});

// ---------- coach-note tags ----------

test("coach notes: tagged against the previous result", async () => {
  const a = await account();
  const note = (i: number, polarity: "working" | "costing", segment: string, impact: number, share: number) =>
    ({ area: "Day of week", polarity, segment, trades: 20, share, pf_without: null, impact, rank: i, text: segment, action: polarity === "costing" ? "act" : null, data: {} });
  const put = async (findings: ReturnType<typeof note>[]) => {
    const id = await add(a);
    await db().insert(s.resultInsights).values(findings.map((f) => ({ resultId: id, area: f.area, segment: f.segment, polarity: f.polarity,
      trades: f.trades, share: String(f.share), data: { text: f.text, action: f.action, impact: f.impact }, rank: f.rank })));
  };
  await put([note(1, "costing", "Monday", 0.40, 0.40), note(2, "costing", "Friday", 0.30, 0.30), note(1, "working", "Tuesday", 0.3, 0.3)]);
  await put([note(1, "costing", "Monday", 0.40, 0.40), note(2, "costing", "Friday", 0.20, 0.20), note(3, "costing", "Thursday", 0.1, 0.1),
    note(1, "working", "Tuesday", 0.5, 0.5)]);
  const g = (await dashboard(a)).trading_accounts[0];
  const tags = Object.fromEntries(g.results[0].coach.costing.map((f) => [f.segment, f.tag]));
  assert.deepEqual(tags, { Monday: "Still costing you", Friday: "Improved", Thursday: null });
  assert.equal(g.results[0].coach.working[0].tag, "Improved");
  assert.equal(g.notes_compared_with, g.results[1].evaluation_date);
});

// ---------- account labels ----------

test("trading accounts are labelled without account digits; 'since' only when two read the same", async () => {
  const a = await account();
  await add(a, { fp: "fp-A" });
  await add(a, { fp: "fp-B" });
  const d = await dashboard(a);
  assert.ok(d.trading_accounts.every((g) => /^Live · since [A-Z][a-z]{2} \d{4}$/.test(g.label.detail)));
  assert.ok(d.trading_accounts.every((g) => !/\d{3}/.test(g.label.name)));
  const b = await account("b@example.com");
  await add(b);
  assert.equal((await dashboard(b)).trading_accounts[0].label.detail, "Live");
});

// ---------- settings ----------

test("settings: details and email choices; email can't change; bad phone refused", async () => {
  const a = await account();
  await add(a, { score: 30 });
  let v = await getSettings(a);
  assert.deepEqual([v?.retest_reminders, v?.updates, v?.monthly_checkup, v?.retest_days], [false, false, true, 90], "Developing: 90 days");
  const bad = await updateSettings(a, { phone: "123" });
  assert.deepEqual(bad && !bad.ok && bad.fields, ["phone"]);
  const ok = await updateSettings(a, { name: " Karim H ", cc: "+961", phone: "3 123 456", retest_reminders: true, updates: true, monthly_checkup: false, email: "x@y.z" } as never);
  assert.ok(ok && ok.ok);
  v = await getSettings(a);
  assert.deepEqual([v?.name, v?.cc, v?.phone, v?.email], ["Karim H", "+961", "3123456", "karim@example.com"]);
  assert.ok(v?.retest_reminder_at && Date.parse(v.retest_reminder_at) > Date.now());
  await updateSettings(a, { retest_reminders: false });
  assert.equal((await getSettings(a))?.retest_reminder_at, null);
});

// ---------- known device and the signed-out banner ----------

test("known device: recognised by its cookie; the link holds this result and sign-in attaches it", async () => {
  const a = await account();
  const token = await rememberDevice(a);
  const cookie = `${KNOWN_COOKIE}=${token}`;
  assert.equal((await knownAccount(cookie))?.id, a);
  assert.equal(await knownAccount(`${KNOWN_COOKIE}=nonsense`), null);
  const { id, accessToken } = await saveResult({ ...structuredClone(DESIGN_FIXTURES.results), account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const } }, ctx);
  assert.equal(await requestKnownSignIn(`${KNOWN_COOKIE}=nonsense`, id, accessToken), "unknown");
  assert.equal(await requestKnownSignIn(cookie, id, accessToken), "sent");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, "karim@example.com");
  let [r] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.deepEqual([r.accountId, r.pendingAccountId], [null, a], "held, not attached, until the link is used");
  const link = /token=([\w-]+)/.exec(outbox[0].text)![1];
  assert.equal((await verifySignIn(link)).ok, true);
  [r] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.equal(r.accountId, a);
});

test("known device: a wrong result token holds nothing", async () => {
  const a = await account();
  const cookie = `${KNOWN_COOKIE}=${await rememberDevice(a)}`;
  const { id } = await saveResult({ ...structuredClone(DESIGN_FIXTURES.results), account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const } }, ctx);
  assert.equal(await requestKnownSignIn(cookie, id, "wrong"), "sent");
  const [r] = await db().select().from(s.results).where(eq(s.results.id, id));
  assert.equal(r.pendingAccountId, null);
});

// ---------- deletion ----------

test("deleting the account removes results, insights, goals and known devices", async () => {
  const a = await account();
  await add(a, { findings: 4 });
  await refreshGoals(a);
  await rememberDevice(a);
  await deleteAccountWithConfirmation(a);
  assert.equal(outbox.filter((m) => m.kind === "account_deleted" && m.to === "karim@example.com").length, 1, "confirmation email sent");
  for (const t of [s.results, s.resultInsights, s.goals, s.knownDevices]) {
    assert.equal((await db().select().from(t)).length, 0);
  }
});
