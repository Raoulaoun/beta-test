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
  status: "scored",
  score: 67,
  band: { code: "emerging_manager", name: "Emerging Manager", meaning: "Close, with a few things to fix" },
  account: { account_type: "live", size_bucket: "$1k–10k", broker: "Example Markets Ltd" },
  history: { months: 14.2, closed_trades: 186 },
  headline: { kind: "weakness", metric: "revenge_sizing", text: "After a loss, you trade 1.6× bigger." },
  pillars,
  red_flag_panel: { none: true, none_text: "No red flags found", summary: null, rows: [], cap_applied: null },
  come_back_date: null,
  notes: [],
};

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
  short: {
    ...base,
    status: "not_enough_history",
    score: null,
    band: { code: "not_enough_history", name: "Not enough history", meaning: "Come back on a set date" },
    history: { months: 2.4, closed_trades: 21 },
    headline: null,
    pillars: null,
    come_back_date: "2027-03-14",
  },
};
