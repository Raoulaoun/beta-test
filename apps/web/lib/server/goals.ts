// Goals (design/account): one active goal per account, no deadline.
// - Set automatically from the latest scored result: the lowest pillar + 10 ("Set
//   automatically", "We picked your lowest pillar. You can change it any time.").
// - "Change goal": raise any pillar to a target (current + 5, 10, 15 or 20, rounded up to
//   the next 5, at most 95), or reach a band above the current score.
// - Reaching it: the goal is marked done with the result that reached it; the next goal is
//   suggested ("Suggested next goal") until the trader sets it or chooses another.
// Worked out from the account's results whenever goals are read, so every way a result
// joins an account (upload, lead, sign-in) is covered by one path.
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";

export const PILLAR_ORDER = ["risk_control", "discipline", "consistency", "risk_adjusted", "depth"] as const;
export const PILLAR_NAMES: Record<string, string> = {
  risk_control: "Risk control", discipline: "Discipline", consistency: "Consistency",
  risk_adjusted: "Risk-adjusted return", depth: "Track record depth",
};
export const GOAL_STEP = 10;

// Lowest band first.
export const BANDS = [
  { code: "developing", name: "Developing", floor: 0 },
  { code: "building", name: "Building", floor: 40 },
  { code: "emerging_manager", name: "Emerging Manager", floor: 60 },
  { code: "professional_grade", name: "Professional Grade", floor: 80 },
] as const;
const bandRank = (code: string | null) => BANDS.findIndex((b) => b.code === code);
const bandByCode = (code: string | null) => BANDS.find((b) => b.code === code) ?? null;

// Coach areas that speak to a pillar: their action is the goal's "biggest lever".
const AREA_PILLAR: Record<string, string> = {
  "After a loss": "discipline", "After a big win": "discipline", "Exits": "discipline", "Fatigue": "discipline",
  "Size consistency": "risk_control",
};

type Scored = { id: string; score: number | null; band: string | null; pillars: { key: string; score: number }[] | null; createdAt: Date };
type Goal = typeof s.goals.$inferSelect;
type PillarPick = { kind: "pillar"; pillar: string; target: number; from: number };
type BandPick = { kind: "band"; band: string; from: number };

const pillarNow = (r: Scored, key: string | null) => Math.round(r.pillars?.find((p) => p.key === key)?.score ?? 0);

export function lowestPillar(r: Scored): PillarPick | null {
  const ps = (r.pillars ?? []).filter((p) => (PILLAR_ORDER as readonly string[]).includes(p.key));
  if (!ps.length) return null;
  const low = [...ps].sort((a, b) => a.score - b.score || PILLAR_ORDER.indexOf(a.key as never) - PILLAR_ORDER.indexOf(b.key as never))[0];
  const from = Math.round(low.score);
  if (from >= 100) return null;
  return { kind: "pillar", pillar: low.key, target: Math.min(100, from + GOAL_STEP), from };
}

// "Change goal" options, as the design computes them.
export function targetOptions(current: number): number[] {
  return [5, 10, 15, 20].map((x) => Math.min(95, Math.ceil((current + x) / 5) * 5)).filter((x, i, a) => a.indexOf(x) === i && x > current);
}
export function bandsAbove(score: number) {
  return BANDS.filter((b) => b.floor > 0 && b.floor > score);
}

export function reached(goal: Goal, r: Scored): boolean {
  if (goal.kind === "pillar") return goal.target !== null && pillarNow(r, goal.pillar) >= goal.target;
  return (r.score ?? 0) >= (bandByCode(goal.band)?.floor ?? 101);
}

// Results that count: full and early scores attached to the account, oldest first.
async function scoredResults(accountId: string): Promise<Scored[]> {
  return db().select({ id: s.results.id, score: s.results.score, band: s.results.band, pillars: s.results.pillars, createdAt: s.results.createdAt })
    .from(s.results)
    .where(and(eq(s.results.accountId, accountId), inArray(s.results.scoreType, ["full", "early"]), isNotNull(s.results.score)))
    .orderBy(s.results.createdAt);
}

async function insertGoal(accountId: string, pick: PillarPick | BandPick, baseline: Scored, status: "auto" | "suggested" | "active") {
  const [g] = await db().insert(s.goals).values(pick.kind === "pillar"
    ? { accountId, kind: "pillar", pillar: pick.pillar, target: pick.target, fromValue: pick.from, baselineResultId: baseline.id, status }
    : { accountId, kind: "band", band: pick.band, fromValue: pick.from, baselineResultId: baseline.id, status }).returning();
  return g;
}

// Brings goals up to date with the results and returns the active goal. Results after the
// active goal's baseline are checked in order: the first that reaches it marks it done and
// the next goal is suggested from that result (and checked in turn).
export async function refreshGoals(accountId: string): Promise<Goal | null> {
  const results = await scoredResults(accountId);
  if (!results.length) return null;
  let [goal] = await db().select().from(s.goals).where(and(eq(s.goals.accountId, accountId), eq(s.goals.active, true)));
  if (!goal) {
    const latest = results[results.length - 1];
    const pick = lowestPillar(latest);
    return pick ? insertGoal(accountId, pick, latest, "auto") : null;
  }
  for (let guard = 0; guard < 20; guard++) {
    const base = results.findIndex((r) => r.id === goal.baselineResultId);
    const hit = results.slice(base + 1).find((r) => reached(goal, r));
    if (!hit) return goal;
    await db().update(s.goals).set({ active: false, achievedAt: hit.createdAt, achievedResultId: hit.id }).where(eq(s.goals.id, goal.id));
    const pick = lowestPillar(hit);
    if (!pick) return null;
    goal = await insertGoal(accountId, pick, hit, "suggested");
  }
  return goal;
}

export type GoalChoice = { kind: "pillar"; pillar: string; target: number } | { kind: "band"; band: string };

// "Save goal": only the options the design offers are accepted.
export async function changeGoal(accountId: string, choice: GoalChoice): Promise<Goal | null> {
  const results = await scoredResults(accountId);
  const latest = results[results.length - 1];
  if (!latest) return null;
  let pick: PillarPick | BandPick;
  if (choice.kind === "pillar") {
    if (!(PILLAR_ORDER as readonly string[]).includes(choice.pillar)) return null;
    const from = pillarNow(latest, choice.pillar);
    if (!targetOptions(from).includes(choice.target)) return null;
    pick = { kind: "pillar", pillar: choice.pillar, target: choice.target, from };
  } else {
    if (!bandsAbove(latest.score ?? 0).some((b) => b.code === choice.band)) return null;
    pick = { kind: "band", band: choice.band, from: latest.score ?? 0 };
  }
  return db().transaction(async (tx) => {
    await tx.update(s.goals).set({ active: false }).where(and(eq(s.goals.accountId, accountId), eq(s.goals.active, true)));
    const [g] = await tx.insert(s.goals).values(pick.kind === "pillar"
      ? { accountId, kind: "pillar", pillar: pick.pillar, target: pick.target, fromValue: pick.from, baselineResultId: latest.id, status: "active" }
      : { accountId, kind: "band", band: pick.band, fromValue: pick.from, baselineResultId: latest.id, status: "active" }).returning();
    return g;
  });
}

// "Set as my next goal".
export async function acceptSuggested(accountId: string): Promise<boolean> {
  const out = await db().update(s.goals).set({ status: "active" })
    .where(and(eq(s.goals.accountId, accountId), eq(s.goals.active, true), eq(s.goals.status, "suggested"))).returning({ id: s.goals.id });
  return out.length > 0;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function monthOf(d: Date, now = new Date()) {
  return d.getUTCFullYear() === now.getUTCFullYear() ? MONTHS[d.getUTCMonth()] : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export type Lever = { area: string; action: string | null };

function card(g: Goal, latest: Scored, lever: string | null) {
  if (g.kind === "band") {
    const b = bandByCode(g.band)!;
    const now = latest.score ?? 0, from = g.fromValue ?? now;
    const pct = Math.max(0, Math.min(100, Math.round(((now - from) / Math.max(1, b.floor - from)) * 100)));
    return { kind: "band" as const, band: b.code, title: `Reach ${b.name}`, pct, fromLabel: `Started at ${from}`, nowLabel: `${now} now`,
      toLabel: `${b.name} at ${b.floor}`, note: `${Math.max(0, b.floor - now)} points to go on your overall score.` };
  }
  const now = pillarNow(latest, g.pillar), from = g.fromValue ?? now, target = g.target ?? now;
  const pct = Math.max(0, Math.min(100, Math.round(((now - from) / Math.max(1, target - from)) * 100)));
  const toGo = `${Math.max(0, target - now)} points to go.`;
  return { kind: "pillar" as const, pillar: g.pillar, title: `${PILLAR_NAMES[g.pillar ?? ""]} from ${now} to ${target}`, pct,
    fromLabel: `Started at ${from}`, nowLabel: `${now} now`, toLabel: `Goal ${target}`,
    note: g.status === "auto" ? "We picked your lowest pillar. You can change it any time."
      : lever ? `${toGo} Your biggest lever: ${lowerFirst(lever)}` : toGo };
}

// The goal card as design/account shows it: state auto | active | reached, the card values,
// the "Goal reached" lines and the "Change goal" options. `levers`: the latest result's
// costing coach notes, in rank order.
export async function goalView(accountId: string, levers: Lever[] = []) {
  const goal = await refreshGoals(accountId);
  const results = await scoredResults(accountId);
  const latest = results[results.length - 1] ?? null;
  if (!latest) return { state: "none" as const };
  const leverFor = (pillar: string | null) => levers.find((l) => l.action && AREA_PILLAR[l.area] === pillar)?.action ?? null;
  const options = {
    pillars: PILLAR_ORDER.map((key) => ({ key, name: PILLAR_NAMES[key], score: pillarNow(latest, key), targets: targetOptions(pillarNow(latest, key)) })),
    bands: bandsAbove(latest.score ?? 0).map((b) => ({ code: b.code, name: b.name, floor: b.floor })),
  };
  if (!goal) return { state: "none" as const, options };
  const [done] = await db().select().from(s.goals)
    .where(and(eq(s.goals.accountId, accountId), eq(s.goals.achievedResultId, latest.id))).orderBy(desc(s.goals.achievedAt)).limit(1);
  const view = { id: goal.id, ...card(goal, latest, goal.kind === "pillar" ? leverFor(goal.pillar) : null) };
  if (goal.status === "suggested" && done) {
    const target = done.kind === "pillar" ? `${PILLAR_NAMES[done.pillar ?? ""]} ${done.target}` : bandByCode(done.band)?.name;
    return {
      state: "reached" as const, options,
      reached: { title: `Goal reached: ${target}`, line: `Up from ${done.fromValue ?? "?"} when you set it in ${monthOf(done.createdAt)}.` },
      next: { title: view.title },
      goal: view,
    };
  }
  return { state: goal.status === "auto" ? "auto" as const : "active" as const, goal: view, options };
}
