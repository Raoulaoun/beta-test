// Display values for design/account, from the dashboard data (lib/server/dashboard.ts).
// Pure functions: no database, no browser.

export type Finding = { area: string; segment: string | null; text: string; action: string | null; rank: number; tag?: string | null };
export type HistoryItem = {
  id: string; evaluation_date: string; created_at: string; score_type: "full" | "early" | "starter"; early: boolean; on_chart: boolean;
  score: number | null; band: { code: string; name: string } | null; pillars: { key: string; name: string; score: number }[];
  period: string | null; closed_trades: number; coach: { working: Finding[]; costing: Finding[] };
};
export type SinceLast = { kind: "none" } | { kind: "first_full" } | { kind: "delta"; score: { delta: number } };
export type TradingAccount = {
  key: string; account_type: string; label: { name: string; detail: string };
  results: HistoryItem[]; since_last: SinceLast; notes_compared_with: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-16" → "16 Nov 2026" (evaluation dates are calendar dates, read as UTC).
export function longDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const shortMonth = (iso: string) => MONTHS[new Date(iso + "T00:00:00Z").getUTCMonth()];

export function initials(name: string | null, email: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 1).toUpperCase();
}
export const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] || "";

export function accountMeta(r: HistoryItem, accountType: string): string {
  const kind = accountType === "demo" ? "Demo account" : "Live account";
  const n = r.closed_trades.toLocaleString("en-US");
  return [kind, r.period, `${n} ${r.closed_trades === 1 ? "trade" : "trades"}`].filter(Boolean).join(" · ");
}

export const bandLabel = (r: HistoryItem) => (r.early ? "Early score" : r.band?.name ?? "");

// The ring: the design's circle of radius 88.
export function ringDash(score: number): string {
  const C = 2 * Math.PI * 88;
  return `${((C * score) / 100).toFixed(1)} ${C.toFixed(1)}`;
}

export function deltaLabel(s: SinceLast): string {
  if (s.kind !== "delta") return "";
  return `${s.score.delta >= 0 ? "+" : ""}${s.score.delta} since your last upload`;
}

// Score history chart. The design's scale is 40–80; it widens in steps of 20 so every
// score stays on the chart.
export type ChartPoint = { id: string; x: number; y: number; score: number; short: string; early: boolean; tx: string; title: string;
  pillars: { name: string; score: number }[]; date: string };
export function chart(results: HistoryItem[]) {
  const H = results.filter((r) => r.on_chart && r.score !== null).slice().reverse(); // oldest first
  const scores = H.map((r) => r.score!);
  const lo = Math.min(40, Math.floor(Math.min(...scores, 40) / 20) * 20);
  const hi = Math.max(80, Math.min(100, Math.ceil(Math.max(...scores, 80) / 20) * 20));
  const yPct = (v: number) => ((hi - v) / (hi - lo)) * 100;
  const xPct = (i: number) => (H.length === 1 ? 50 : 4 + (i / (H.length - 1)) * 92);
  const months = H.map((r) => shortMonth(r.evaluation_date));
  const points: ChartPoint[] = H.map((r, i) => ({
    id: r.id, x: xPct(i), y: yPct(r.score!), score: r.score!, early: r.early,
    short: months.filter((m) => m === months[i]).length > 1 ? `${new Date(r.evaluation_date + "T00:00:00Z").getUTCDate()} ${months[i]}` : months[i],
    tx: i === 0 ? "-10%" : i === H.length - 1 ? "-90%" : "-50%",
    title: `${longDate(r.evaluation_date)} · ${r.score} · ${r.early ? "Early score" : r.band?.name ?? ""}`,
    pillars: r.pillars.map((p) => ({ name: p.name, score: p.score })), date: longDate(r.evaluation_date),
  }));
  const lastEarly = H.reduce((k, r, i) => (r.early ? i : k), -1);
  const pt = (p: ChartPoint) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const ticks: { v: number; top: number }[] = [];
  for (let v = hi; v >= lo; v -= 20) ticks.push({ v, top: yPct(v) });
  return {
    points, ticks,
    linePtsEarly: lastEarly >= 0 ? points.slice(0, Math.min(points.length, lastEarly + 2)).map(pt).join(" ") : "",
    linePts: points.map(pt).slice(Math.max(0, lastEarly + 1)).join(" "),
  };
}

export function starterLine(r: HistoryItem): { title: string; body: string } {
  const n = r.closed_trades;
  return { title: `${longDate(r.evaluation_date)} · Starter read`, body: `${n} closed ${n === 1 ? "trade" : "trades"}. No score yet, so it isn't on the chart.` };
}
