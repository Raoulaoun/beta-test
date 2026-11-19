// Dashboard data for a signed-in account: score history per trading account, "since your
// last result", the full coach findings, and the goal.
// - Trading accounts are grouped by the hashed account ID (number + server); results without
//   one (older statements) form their own group. Newest group first; that is the default.
// - Early scores stay in the history, marked early. Starter reads are listed but are not on
//   the chart (no score).
// - "Since your last result" compares only results of the same score type. The first full
//   score after early ones has no delta: it is "Your first full score".
import { asc, desc, eq, inArray } from "drizzle-orm";
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
type Finding = { area: string; segment: string | null; text: string; action: string | null; trades: number | null; share: number | null; rank: number };

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
  latest_at: string; results: HistoryItem[]; since_last: SinceLast;
};

export async function dashboard(accountId: string) {
  const rows = await db().select().from(s.results).where(eq(s.results.accountId, accountId)).orderBy(desc(s.results.createdAt));
  const ins = rows.length
    ? await db().select().from(s.resultInsights).where(inArray(s.resultInsights.resultId, rows.map((r) => r.id))).orderBy(asc(s.resultInsights.rank))
    : [];
  const findingsOf = (id: string) => ins.filter((f) => f.resultId === id).map((f) => {
    const d = (f.data ?? {}) as { text?: string; action?: string | null };
    return { area: f.area, segment: f.segment, polarity: f.polarity, text: d.text ?? "", action: d.action ?? null,
      trades: f.trades, share: f.share === null ? null : Number(f.share), rank: f.rank };
  });

  const groups = new Map<string, TradingAccount>();
  for (const r of rows) {
    const key = r.accountFingerprint ?? "unidentified";
    if (!groups.has(key)) {
      groups.set(key, { key, platform: r.platform, broker: r.broker, account_type: r.accountType,
        latest_at: r.createdAt.toISOString(), results: [], since_last: { kind: "none" } });
    }
    groups.get(key)!.results.push(item(r, findingsOf(r.id)));
  }
  const trading_accounts = [...groups.values()];
  for (const g of trading_accounts) g.since_last = sinceLast(g.results);
  return {
    trading_accounts,
    default_trading_account: trading_accounts[0]?.key ?? null,
    goal: await goalView(accountId),
  };
}
