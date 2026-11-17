import type { ScoreResult } from "./types.ts";

// Dev-only sample results that reproduce the design's sample data (score 67, 14 months,
// 186 trades), so built screens can be compared with design/screenshots side by side.
// Never reachable in production: see designPreviewEnabled().

export function designPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DESIGN_PREVIEW === "1";
}

const pillars = [
  { key: "risk_control", name: "Risk control", weight: 0.25, score: 74 },
  { key: "discipline", name: "Discipline", weight: 0.2, score: 58 },
  { key: "consistency", name: "Consistency", weight: 0.2, score: 71 },
  { key: "risk_adjusted", name: "Risk-adjusted return", weight: 0.2, score: 66 },
  { key: "depth", name: "Track record depth", weight: 0.15, score: 62 },
];

const base: ScoreResult = {
  scoring_version: "1.0.0",
  evaluation_date: "2026-11-16",
  score_type: "full",
  status: "full",
  score: 67,
  band: { code: "emerging_manager", name: "Emerging Manager", meaning: "Close, with a few things to fix" },
  account: { account_type: "live", size_bucket: "$1k–10k", broker: "Example Markets Ltd" },
  history: { months: 14.2, closed_trades: 186 },
  headline: { kind: "weakness", metric: "revenge_sizing", text: "After a loss, you trade 1.6× bigger." },
  pillars,
  red_flag_panel: { none: true, none_text: "No red flags found", summary: null, rows: [], cap_applied: null },
  period: { start: "2025-09-01T00:00:00", end: "2026-11-16T00:00:00", days: 441, label: "14 months" },
  nudge: null,
  progress: null,
  early: null,
  starter: null,
  retest_default: false,
  notes: [],
};

const NUDGE = "Your file only covers 3 weeks. Did you choose All History? Export again for a more accurate score.";

export const DESIGN_FIXTURES: Record<string, ScoreResult> = {
  results: base,
  warn: {
    ...base,
    score: 40,
    band: { code: "building", name: "Building", meaning: "Promising, with clear gaps" },
    red_flag_panel: {
      none: false, none_text: null, summary: null, cap_applied: 40,
      rows: [{ code: "martingale", text: "Martingale detected. Score capped at 40.", cap: 40 }],
    },
  },
  early: {
    ...base,
    score_type: "early",
    status: "early",
    score: 64,
    band: { code: "emerging_manager", name: "Emerging Manager", meaning: "Close, with a few things to fix" },
    history: { months: 2.4, closed_trades: 21 },
    period: { start: "2026-09-01T00:00:00", end: "2026-11-16T00:00:00", days: 76, label: "2 months" },
    progress: [{ key: "months", current: 2, target: 3 }, { key: "trades", current: 21, target: 30 }],
    early: { label: "Early score", line: "Early score, based on 21 trades over 2 months. Upload more history for your full score.", cap: 69 },
    retest_default: true,
  },
  starter: {
    ...base,
    score_type: "starter",
    status: "starter",
    score: null,
    band: null,
    pillars: null,
    headline: null,
    red_flag_panel: null,
    history: { months: 0.3, closed_trades: 3 },
    period: { start: "2026-10-27T00:00:00", end: "2026-11-16T00:00:00", days: 20, label: "2 weeks" },
    progress: [{ key: "months", current: 0, target: 3 }, { key: "trades", current: 3, target: 30 }],
    starter: {
      heading: "Your starter read",
      line: "You have 3 closed trades so far. Here's what we can already see, and how to build a record investors trust.",
      metrics: [
        { key: "stop_usage", name: "Stop loss usage", display: "33%", score: 5, kind: "advice",
          text: "Only 33% of your trades had a stop loss. An investor's first question is \"what happens if you're wrong?\", and a stop is the answer.",
          actions: ["Place the stop with the entry, every time, before the trade can move against you.", "Never widen a stop once the trade is open.", "If a trade has no logical stop level, it is not a trade."] },
        { key: "avg_loss", name: "Average loss per trade", display: "0.3%", score: 100, kind: "strength",
          text: "You keep losses small: 0.3% per trade on average." },
        { key: "hold_asymmetry", name: "Holding losers", display: "6.0×", score: 0, kind: "advice",
          text: "You hold losing trades 6.0× longer than winners. Hoping a loser comes back while cutting winners early drains an account slowly.",
          actions: ["Let the stop decide when a loser ends, not your feelings.", "Set a time limit: if a trade hasn't worked within your normal holding time, close it.", "Use a target or trailing stop on winners instead of closing them early."] },
      ],
    },
    retest_default: true,
  },
};

export const withNudge = (r: ScoreResult): ScoreResult => ({ ...r, nudge: NUDGE });
