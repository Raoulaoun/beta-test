import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { saveResult } from "../../lib/server/results.ts";
import { dashboard } from "../../lib/server/dashboard.ts";
import { changeGoal, goalOptions, goalView, refreshGoals } from "../../lib/server/goals.ts";
import { getSettings, updateSettings } from "../../lib/server/accountSettings.ts";
import { knownAccount, KNOWN_COOKIE, rememberDevice } from "../../lib/server/known.ts";
import { deleteAccount, requestKnownSignIn, verifySignIn } from "../../lib/server/auth.ts";
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

test("goal: auto-set to the weakest pillar + 10, track record depth left out", async () => {
  const a = await account();
  assert.equal(await refreshGoals(a), null, "no scored result, no goal");
  await add(a, { type: "starter" });
  assert.equal(await refreshGoals(a), null, "a starter read sets no goal");
  await add(a, { pillars: { discipline: 58, depth: 12 } });
  const v = await goalView(a);
  assert.deepEqual({ ...v.active, id: undefined, set_at: undefined },
    { id: undefined, set_at: undefined, kind: "pillar", pillar: "discipline", name: "Discipline", target: 68, current: 58 });
  await refreshGoals(a);
  assert.equal((await db().select().from(s.goals).where(eq(s.goals.accountId, a))).length, 1, "idempotent: still one goal");
});

test("goal: reaching it marks it done with that result and suggests the next", async () => {
  const a = await account();
  await add(a, { pillars: { discipline: 58 } });
  await refreshGoals(a);
  await add(a, { pillars: { discipline: 64 } });
  assert.equal((await goalView(a)).active?.pillar, "discipline", "64 is not 68 yet");
  const hit = await add(a, { pillars: { discipline: 69, risk_adjusted: 61 } });
  const v = await goalView(a);
  assert.equal(v.just_reached?.pillar, "discipline");
  assert.deepEqual([v.active?.pillar, v.active?.target], ["risk_adjusted", 71], "next: the new weakest + 10");
  const [done] = await db().select().from(s.goals).where(eq(s.goals.achievedResultId, hit));
  assert.ok(done && !done.active && done.achievedAt);
  await add(a, { pillars: { discipline: 69, risk_adjusted: 62 } });
  assert.equal((await goalView(a)).just_reached, null, "'just reached' only for the result that reached it");
});

test("goal: change to the band option; reached when the band is reached", async () => {
  const a = await account();
  await add(a, { score: 55 });
  const opts = await goalOptions(a);
  assert.deepEqual(opts.band, { kind: "band", band: "emerging_manager", name: "Emerging Manager", floor: 60, current: "building" });
  await changeGoal(a, "band");
  const v = await goalView(a);
  assert.deepEqual([v.active?.kind, v.active?.band, v.active?.target, v.active?.current], ["band", "emerging_manager", 60, 55]);
  assert.equal((await db().select().from(s.goals).where(eq(s.goals.active, true))).length, 1, "one active goal");
  await add(a, { score: 61 });
  const after = await goalView(a);
  assert.equal(after.just_reached?.band, "emerging_manager");
  assert.equal(after.active?.kind, "pillar", "next suggestion is the pillar goal");
});

// ---------- settings ----------

test("settings: email choices; retest reminder off clears the date, on sets it again", async () => {
  const a = await account();
  await add(a);
  let v = await getSettings(a);
  assert.deepEqual([v?.retest_reminders, v?.updates, v?.monthly_checkup], [false, false, true]);
  v = await updateSettings(a, { retest_reminders: true, updates: true, monthly_checkup: false });
  assert.deepEqual([v?.retest_reminders, v?.updates, v?.monthly_checkup], [true, true, false]);
  assert.ok(v?.retest_reminder_at && Date.parse(v.retest_reminder_at) > Date.now());
  v = await updateSettings(a, { retest_reminders: false });
  assert.equal(v?.retest_reminder_at, null);
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
  await deleteAccount(a);
  for (const t of [s.results, s.resultInsights, s.goals, s.knownDevices]) {
    assert.equal((await db().select().from(t)).length, 0);
  }
});
