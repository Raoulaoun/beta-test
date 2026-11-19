// Design preview only (DESIGN_PREVIEW): design/account's sample data in the dashboard's
// shape, for side-by-side checks against the design. Never used for real accounts.
import type { DashData, GoalState } from "../components/account/Dashboard.tsx";
import type { HistoryItem, TradingAccount } from "./accountView.ts";
import type { SettingsData } from "../components/account/Settings.tsx";

const PN: [string, string][] = [["risk_control", "Risk control"], ["discipline", "Discipline"], ["consistency", "Consistency"], ["risk_adjusted", "Risk-adjusted return"], ["depth", "Track record depth"]];
const band = (x: number) => (x >= 80 ? ["professional_grade", "Professional Grade"] : x >= 60 ? ["emerging_manager", "Emerging Manager"] : x >= 40 ? ["building", "Building"] : ["developing", "Developing"]);
const W = [["Session", "The London session is your edge: 64% of your profit comes from it.", "Improved"], ["Size consistency", "Your risk per trade is consistent.", "Improved"], ["Fatigue", "Your quality holds up through the day.", "Improved"]];
const K = [["Instrument", "XAUUSD produced 70% of your losses. Without it, your profit factor would be 1.90.", "Pause XAUUSD or trade it at half size until you understand why it costs you.", "Still costing you"],
  ["After a big win", "After a big win, you trade 1.6× bigger on the next trades.", "Keep the same size for the 5 trades after any big win.", "Improved"],
  ["Day of week", "Friday is your most expensive day: 33% of your losses.", "Cut size by half on Friday until the pattern changes.", "Still costing you"]];

type Row = [string, number, number[], boolean?];
const A0: Row[] = [["2026-03-03", 48, [55, 40, 52, 47, 44], true], ["2026-04-07", 51, [58, 43, 54, 50, 46], true], ["2026-05-12", 52, [60, 41, 55, 50, 49]], ["2026-07-14", 58, [64, 47, 60, 57, 52]], ["2026-09-15", 61, [68, 52, 64, 60, 56]], ["2026-11-16", 67, [74, 58, 71, 66, 62]]];
const A1: Row[] = [["2026-08-10", 44, [52, 38, 47, 44, 36]], ["2026-10-12", 49, [57, 42, 51, 49, 40]]];

function item([date, score, ps, early]: Row, i: number, months: number, trades: number, tags: boolean): HistoryItem {
  const [code, name] = band(score);
  return { id: `${date}-${i}`, evaluation_date: date, created_at: date + "T10:00:00Z", score_type: early ? "early" : "full", early: !!early, on_chart: true,
    score, band: { code, name }, pillars: PN.map(([key, n], j) => ({ key, name: n, score: ps[j] })), period: `${months} months`, closed_trades: trades,
    coach: { working: W.map(([area, text, tag], r) => ({ area, segment: null, text, action: null, rank: r + 1, tag: tags ? tag : null })),
      costing: K.map(([area, text, action, tag], r) => ({ area, segment: null, text, action, rank: r + 1, tag: tags ? tag : null })) } };
}
const starter: HistoryItem = { id: "starter", evaluation_date: "2026-02-02", created_at: "2026-02-02T10:00:00Z", score_type: "starter", early: false, on_chart: false,
  score: null, band: null, pillars: [], period: "1 week", closed_trades: 3, coach: { working: [], costing: [] } };

export function previewDashboard(q: Record<string, string | undefined>): { data: DashData; preview: { acctOpen?: boolean; goal?: "change"; kind?: "pillar" | "band" } } {
  const mode = q.view === "first" ? "first" : q.view === "firstfull" ? "firstfull" : "full";
  let h0 = A0;
  if (mode === "first") h0 = [A0[A0.length - 1]];
  if (mode === "firstfull") h0 = A0.slice(0, 3);
  const tags = mode !== "first";
  const r0 = h0.map((r, i) => item(r, i, mode === "firstfull" && i === h0.length - 1 ? 3 : 14, mode === "firstfull" && i === h0.length - 1 ? 41 : 186, tags)).reverse();
  if (mode !== "first") r0.splice(r0.length, 0, starter);
  const acc0: TradingAccount = { key: "a0", account_type: "live", label: { name: "IC Markets", detail: "Live" }, results: r0,
    since_last: mode === "firstfull" ? { kind: "first_full" } : mode === "first" ? { kind: "none" } : { kind: "delta", score: { delta: 6 } },
    notes_compared_with: mode === "first" ? null : h0[h0.length - 2][0] };
  const acc1: TradingAccount = { key: "a1", account_type: "live", label: { name: "Exness", detail: "Live" },
    results: A1.map((r, i) => item(r, i, 8, 112, true)).reverse(), since_last: { kind: "delta", score: { delta: 5 } }, notes_compared_with: "2026-08-10" };
  const L = h0[h0.length - 1];
  const options = { pillars: PN.map(([key, name], j) => ({ key, name, score: L[2][j], targets: [5, 10, 15, 20].map((x) => Math.min(95, Math.ceil((L[2][j] + x) / 5) * 5)).filter((x, i, a) => a.indexOf(x) === i) })),
    bands: [["emerging_manager", "Emerging Manager", 60], ["professional_grade", "Professional Grade", 80]].filter((b) => (b[2] as number) > L[1]).map(([code, name, floor]) => ({ code: code as string, name: name as string, floor: floor as number })) };
  const now = L[2][1];
  const card = { kind: "pillar" as const, pillar: "discipline", title: `Discipline from ${now} to 70`, pct: Math.round(((now - 47) / (70 - 47)) * 100),
    fromLabel: "Started at 47", nowLabel: `${now} now`, toLabel: "Goal 70",
    note: q.goal === "active" ? `${70 - now} points to go. Your biggest lever: keep the same size for the 5 trades after any big win.` : "We picked your lowest pillar. You can change it any time." };
  const goal: GoalState = q.goal === "reached"
    ? { state: "reached", goal: card, options, reached: { title: "Goal reached: Discipline 70", line: "Up from 47 when you set it in May." }, next: { title: "Track record depth from 62 to 70" } }
    : { state: q.goal === "active" ? "active" : "auto", goal: card, options };
  return {
    data: { name: "Karim Haddad", trading_accounts: q.accounts === "one" ? [acc0] : [acc0, acc1], default_trading_account: "a0", goal },
    preview: { acctOpen: q.acctmenu === "1", goal: q.goal === "change" ? "change" : undefined, kind: q.kind === "band" ? "band" : q.kind === "pillar" ? "pillar" : undefined },
  };
}

export const PREVIEW_SETTINGS: SettingsData = { email: "karim@example.com", name: "Karim Haddad", cc: "+961", phone: "3 100 200", retest_reminders: true, monthly_checkup: true, updates: false, retest_days: 60 };
