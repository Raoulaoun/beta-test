// Goals: one active goal per account, no deadline.
// - Auto-set from the latest scored result: the weakest pillar + 10 (track record depth is
//   left out: it only grows with time, so it is not something to work on).
// - "Change goal" offers the band option: reach the next band.
// - Reaching it: the goal is marked done (with the result that reached it) and the next
//   suggestion is set from that result.
// Worked out from the account's results whenever goals are read (dashboard, check-up email),
// so every way a result joins an account (upload, lead, sign-in) is covered by one path.
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";

export const PILLAR_ORDER = ["risk_control", "discipline", "consistency", "risk_adjusted", "depth"] as const;
export const PILLAR_NAMES: Record<string, string> = {
  risk_control: "Risk control", discipline: "Discipline", consistency: "Consistency",
  risk_adjusted: "Risk-adjusted return", depth: "Track record depth",
};
const GOAL_PILLARS = PILLAR_ORDER.filter((p) => p !== "depth");
export const GOAL_STEP = 10;

// Lowest band first.
export const BANDS = [
  { code: "developing", name: "Developing", floor: 0 },
  { code: "building", name: "Building", floor: 40 },
  { code: "emerging_manager", name: "Emerging Manager", floor: 60 },
  { code: "professional_grade", name: "Professional Grade", floor: 80 },
] as const;
const bandRank = (code: string | null) => BANDS.findIndex((b) => b.code === code);

type Scored = { id: string; score: number | null; band: string | null; pillars: { key: string; score: number }[] | null; createdAt: Date };
export type GoalOption = { kind: "pillar"; pillar: string; name: string; target: number; current: number }
  | { kind: "band"; band: string; name: string; floor: number; current: string | null };

export function pillarOption(r: Scored): GoalOption | null {
  const ps = (r.pillars ?? []).filter((p) => (GOAL_PILLARS as readonly string[]).includes(p.key));
  if (!ps.length) return null;
  const weakest = [...ps].sort((a, b) => a.score - b.score || PILLAR_ORDER.indexOf(a.key as never) - PILLAR_ORDER.indexOf(b.key as never))[0];
  const current = Math.round(weakest.score);
  if (current >= 100) return null;
  return { kind: "pillar", pillar: weakest.key, name: PILLAR_NAMES[weakest.key], target: Math.min(100, current + GOAL_STEP), current };
}

export function bandOption(r: Scored): GoalOption | null {
  const next = BANDS[bandRank(r.band) + 1];
  if (!r.band || !next) return null;
  return { kind: "band", band: next.code, name: next.name, floor: next.floor, current: r.band };
}

type Goal = typeof s.goals.$inferSelect;

export function reached(goal: Goal, r: Scored): boolean {
  if (goal.kind === "pillar") {
    const p = r.pillars?.find((x) => x.key === goal.pillar);
    return !!p && goal.target !== null && Math.round(p.score) >= goal.target;
  }
  return bandRank(r.band) >= bandRank(goal.band);
}

// Results that count: full and early scores attached to the account, oldest first.
async function scoredResults(accountId: string): Promise<Scored[]> {
  return db().select({ id: s.results.id, score: s.results.score, band: s.results.band, pillars: s.results.pillars, createdAt: s.results.createdAt })
    .from(s.results)
    .where(and(eq(s.results.accountId, accountId), inArray(s.results.scoreType, ["full", "early"]), isNotNull(s.results.score)))
    .orderBy(s.results.createdAt);
}

async function insertGoal(accountId: string, option: GoalOption, baseline: Scored) {
  const [g] = await db().insert(s.goals).values(option.kind === "pillar"
    ? { accountId, kind: "pillar", pillar: option.pillar, target: option.target, baselineResultId: baseline.id }
    : { accountId, kind: "band", band: option.band, baselineResultId: baseline.id }).returning();
  return g;
}

// Brings the account's goals up to date with its results and returns the active goal.
// Results after the active goal's baseline are checked in order: the first that reaches it
// marks it done, and the next goal is suggested from that result (and checked in turn).
export async function refreshGoals(accountId: string): Promise<Goal | null> {
  const results = await scoredResults(accountId);
  if (!results.length) return null;
  let [goal] = await db().select().from(s.goals).where(and(eq(s.goals.accountId, accountId), eq(s.goals.active, true)));
  if (!goal) {
    const latest = results[results.length - 1];
    const option = pillarOption(latest) ?? bandOption(latest);
    return option ? insertGoal(accountId, option, latest) : null;
  }
  for (let guard = 0; guard < 20; guard++) {
    const base = results.findIndex((r) => r.id === goal.baselineResultId);
    const after = results.slice(base + 1);
    const hit = after.find((r) => reached(goal, r));
    if (!hit) return goal;
    await db().update(s.goals).set({ active: false, achievedAt: hit.createdAt, achievedResultId: hit.id }).where(eq(s.goals.id, goal.id));
    const option = pillarOption(hit) ?? bandOption(hit);
    if (!option) return null;
    goal = await insertGoal(accountId, option, hit);
  }
  return goal;
}

// "Change goal": the two options from the latest scored result.
export async function goalOptions(accountId: string) {
  const results = await scoredResults(accountId);
  const latest = results[results.length - 1];
  return latest ? { pillar: pillarOption(latest), band: bandOption(latest) } : { pillar: null, band: null };
}

export async function changeGoal(accountId: string, kind: "pillar" | "band"): Promise<Goal | null> {
  const results = await scoredResults(accountId);
  const latest = results[results.length - 1];
  if (!latest) return null;
  const option = kind === "pillar" ? pillarOption(latest) : bandOption(latest);
  if (!option) return null;
  return db().transaction(async (tx) => {
    await tx.update(s.goals).set({ active: false }).where(and(eq(s.goals.accountId, accountId), eq(s.goals.active, true)));
    const [g] = await tx.insert(s.goals).values(option.kind === "pillar"
      ? { accountId, kind: "pillar", pillar: option.pillar, target: option.target, baselineResultId: latest.id }
      : { accountId, kind: "band", band: option.band, baselineResultId: latest.id }).returning();
    return g;
  });
}

// The goal as the dashboard shows it: target, where the trader is now, and the goal just
// reached (when the latest result reached one).
export async function goalView(accountId: string) {
  const goal = await refreshGoals(accountId);
  const results = await scoredResults(accountId);
  const latest = results[results.length - 1] ?? null;
  const [justReached] = latest
    ? await db().select().from(s.goals).where(and(eq(s.goals.accountId, accountId), eq(s.goals.achievedResultId, latest.id)))
      .orderBy(desc(s.goals.achievedAt)).limit(1)
    : [];
  const describe = (g: Goal) => g.kind === "pillar"
    ? { kind: "pillar" as const, pillar: g.pillar, name: PILLAR_NAMES[g.pillar ?? ""], target: g.target,
        current: latest ? Math.round(latest.pillars?.find((p) => p.key === g.pillar)?.score ?? 0) : null }
    : { kind: "band" as const, band: g.band, name: BANDS.find((b) => b.code === g.band)?.name ?? null,
        target: BANDS.find((b) => b.code === g.band)?.floor ?? null, current: latest?.score ?? null };
  return {
    active: goal ? { id: goal.id, ...describe(goal), set_at: goal.createdAt } : null,
    just_reached: justReached ? { id: justReached.id, ...describe(justReached), reached_at: justReached.achievedAt } : null,
  };
}
