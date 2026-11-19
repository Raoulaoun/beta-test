// Dashboard data for a signed-in account: score history per trading account, "since your
// last result", the full coach findings, and the goal.
// - Trading accounts are grouped by the hashed account ID (number + server); results without
//   one (older statements) form their own group. Newest group first; that is the default.
// - Early scores stay in the history, marked early. Starter reads are listed but are not on
//   the chart (no score).
// - "Since your last result" compares only results of the same score type. The first full
//   score after early ones has no delta: it is "Your first full score".
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { goalView, PILLAR_NAMES, PILLAR_ORDER } from "./goals.ts";

type Row = typeof s.results.$inferSelect;
type Payload = { band?: { code: string; name: string } | null; red_flags?: { code: string; text?: string }[];
  headline?: { text: string } | null; period?: { label: string } | null; history?: { months: number; closed_trades: number } };

export type HistoryItem = {
  id: string; evaluation_date: string; created_at: string; scoring_version: string;
  score_type: "full" | "early" | "starter"; early: boolean; on_chart: boolean;
  score: number | null; band: { code: string; name: string } | null;
  pillars: { key: string; name: string; score: number }[];
  red_flags: string[]; headline: string | null; period: string | null; closed_trades: number;
  coach: { working: Finding[]; costing: Finding[] };
};
type Finding = { area: string; segment: string | null; polarity?: string; text: string; action: string | null; trades: number | null;
  share: number | null; impact: number | null; rank: number; tag?: "Improved" | "Still costing you" | null };

export type SinceLast =
  | { kind: "none" }
  | { kind: "first_full" }
  | { kind: "delta"; previous_id: string; previous_date: string; score: { from: number; to: number; delta: number };
      pillars: { key: string; name: string; from: number; to: number; delta: number }[];
      flags_resolved: string[]; flags_new: string[] };

const round = (n: number) => Math.round(n);

function item(r: Row, findings: Finding[]): HistoryItem {
  const p = r.payload as Payload;
  const pillars = PILLAR_ORDER.map((key) => r.pillars?.find((x) => x.key === key))
    .filter(Boolean).map((x) => ({ key: x!.key, name: PILLAR_NAMES[x!.key], score: round(x!.score) }));
  const by = (pol: string) => findings.filter((f) => (f as Finding & { polarity: string }).polarity === pol).sort((a, b) => a.rank - b.rank);
  return {
    id: r.id, evaluation_date: r.evaluationDate, created_at: r.createdAt.toISOString(), scoring_version: r.scoringVersion,
    score_type: r.scoreType, early: r.scoreType === "early", on_chart: r.scoreType !== "starter" && r.score !== null,
    score: r.score, band: p.band ? { code: p.band.code, name: p.band.name } : null, pillars,
    red_flags: r.redFlags, headline: p.headline?.text ?? null, period: p.period?.label ?? null, closed_trades: r.closedTrades,
    coach: { working: by("working"), costing: by("costing") },
  };
}

// Newest first within a group. Compares the latest result with the previous one of the same
// score type.
export function sinceLast(items: HistoryItem[]): SinceLast {
  const [latest, ...older] = items;
  if (!latest || latest.score_type === "starter" || latest.score === null) return { kind: "none" };
  const prev = older.find((x) => x.score_type === latest.score_type && x.score !== null);
  if (!prev) {
    return latest.score_type === "full" && older.some((x) => x.score_type === "early") ? { kind: "first_full" } : { kind: "none" };
  }
  return {
    kind: "delta", previous_id: prev.id, previous_date: prev.evaluation_date,
    score: { from: prev.score!, to: latest.score, delta: latest.score - prev.score! },
    pillars: latest.pillars.map((p) => {
      const from = prev.pillars.find((x) => x.key === p.key)?.score ?? 0;
      return { key: p.key, name: p.name, from, to: p.score, delta: p.score - from };
    }),
    flags_resolved: prev.red_flags.filter((f) => !latest.red_flags.includes(f)),
    flags_new: latest.red_flags.filter((f) => !prev.red_flags.includes(f)),
  };
}

export type TradingAccount = {
  key: string; platform: string; broker: string | null; account_type: string;
  label: { name: string; detail: string };
  latest_at: string; first_at: string; results: HistoryItem[]; since_last: SinceLast;
  notes_compared_with: string | null;
};

// Coach-note tags against the previous scored result of the same trading account:
// "Still costing you": the same costing note was there last time (and costs no less);
// "Improved": a costing note that now costs less, or a working note that is now stronger.
export function tagNotes(latest: HistoryItem, prev: HistoryItem | undefined) {
  if (!prev) return;
  const key = (f: Finding) => `${f.area}|${f.segment ?? ""}`;
  const before = (pol: "working" | "costing") => new Map(prev.coach[pol].map((f) => [key(f), f]));
  const pc = before("costing"), pw = before("working");
  for (const f of latest.coach.costing) {
    const old = pc.get(key(f));
    f.tag = !old ? null : (f.impact ?? 0) < (old.impact ?? 0) - 0.005 ? "Improved" : "Still costing you";
  }
  for (const f of latest.coach.working) {
    const old = pw.get(key(f));
    f.tag = old && (f.share ?? 0) > (old.share ?? 0) + 0.005 ? "Improved" : null;
  }
}

// Trading accounts are named without any digits of the account number (never stored):
// broker and account type, plus "since <month year>" when two would read the same.
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function labelAccounts(groups: TradingAccount[]) {
  const base = (g: TradingAccount) => ({ name: g.broker ?? `${g.platform} account`, detail: g.account_type === "demo" ? "Demo" : "Live" });
  for (const g of groups) {
    const b = base(g);
    const same = groups.filter((o) => o !== g && base(o).name === b.name && base(o).detail === b.detail);
    const d = new Date(g.first_at);
    g.label = same.length ? { name: b.name, detail: `${b.detail} · since ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}` } : b;
  }
}

export async function dashboard(accountId: string) {
  const rows = await db().select().from(s.results).where(eq(s.results.accountId, accountId)).orderBy(desc(s.results.createdAt));
  const ins = rows.length
    ? await db().select().from(s.resultInsights).where(inArray(s.resultInsights.resultId, rows.map((r) => r.id))).orderBy(asc(s.resultInsights.rank))
    : [];
  const findingsOf = (id: string) => ins.filter((f) => f.resultId === id).map((f) => {
    const d = (f.data ?? {}) as { text?: string; action?: string | null; impact?: number };
    return { area: f.area, segment: f.segment, polarity: f.polarity, text: d.text ?? "", action: d.action ?? null,
      trades: f.trades, share: f.share === null ? null : Number(f.share), impact: typeof d.impact === "number" ? d.impact : null, rank: f.rank };
  });

  const groups = new Map<string, TradingAccount>();
  for (const r of rows) {
    const key = r.accountFingerprint ?? "unidentified";
    if (!groups.has(key)) {
      groups.set(key, { key, platform: r.platform, broker: r.broker, account_type: r.accountType, label: { name: "", detail: "" },
        latest_at: r.createdAt.toISOString(), first_at: r.createdAt.toISOString(), results: [], since_last: { kind: "none" }, notes_compared_with: null });
    }
    const g = groups.get(key)!;
    g.first_at = r.createdAt.toISOString(); // rows come newest first
    g.results.push(item(r, findingsOf(r.id)));
  }
  const trading_accounts = [...groups.values()];
  for (const g of trading_accounts) {
    g.since_last = sinceLast(g.results);
    const scored = g.results.filter((x) => x.on_chart);
    if (scored[0]) {
      tagNotes(scored[0], scored[1]);
      g.notes_compared_with = scored[1]?.evaluation_date ?? null;
    }
  }
  labelAccounts(trading_accounts);
  const latestScored = trading_accounts.flatMap((g) => g.results).filter((x) => x.on_chart)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    trading_accounts,
    default_trading_account: trading_accounts[0]?.key ?? null,
    goal: await goalView(accountId, latestScored ? latestScored.coach.costing.map((f) => ({ area: f.area, action: f.action })) : []),
  };
}

// The latest scored result's costing notes, for the goal's "biggest lever".
export async function latestLevers(accountId: string) {
  const [r] = await db().select({ id: s.results.id }).from(s.results)
    .where(and(eq(s.results.accountId, accountId), inArray(s.results.scoreType, ["full", "early"])))
    .orderBy(desc(s.results.createdAt)).limit(1);
  if (!r) return [];
  const rows = await db().select().from(s.resultInsights)
    .where(and(eq(s.resultInsights.resultId, r.id), eq(s.resultInsights.polarity, "costing"))).orderBy(asc(s.resultInsights.rank));
  return rows.map((f) => ({ area: f.area, action: ((f.data ?? {}) as { action?: string | null }).action ?? null }));
}
