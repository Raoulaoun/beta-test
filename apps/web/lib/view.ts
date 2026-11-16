import type { ErrKey, FileErrKey, Pillar, RedFlagPanel, ScoreResult } from "./types.ts";

// File errors: copy from design/flow (renderVals), word for word.
export const ERRORS: Record<FileErrKey, [string, string]> = {
  mt4: ["This looks like an MT4 file. We only support MT5 for now.", "Export the report from MetaTrader 5 and upload it again."],
  empty: ["This report has no trades in it.", "Make sure you chose All History before saving the report, then try again."],
  notstatement: ["This doesn't look like an MT5 statement.", "Upload the XLSX or HTML report saved from the History tab in MetaTrader 5."],
  toolarge: ["This file is over 10 MB.", "Save the report as XLSX, which is usually much smaller, and try again."],
};

// Service errors: docs/advice-texts.md, "Upload error messages", word for word. Title only
// until body copy is supplied.
export const SERVICE_ERRORS: Record<"server" | "ratelimit", [string, string | null]> = {
  server: ["Server error", null],
  ratelimit: ["Too many uploads", null],
};

export function errorCopy(key: ErrKey): [string, string | null] {
  return key === "server" || key === "ratelimit" ? SERVICE_ERRORS[key] : ERRORS[key];
}

export const isFileError = (key: ErrKey) => key !== "server" && key !== "ratelimit";

export const MAX_BYTES = 10 * 1024 * 1024;

// Client-side checks, in the design's order (design/flow handleFile).
export function precheck(file: { name: string; size: number }): ErrKey | null {
  const n = file.name || "statement";
  const ext = (n.split(".").pop() || "").toLowerCase();
  if (file.size > MAX_BYTES) return "toolarge";
  if (/mt4|\.ex4/i.test(n)) return "mt4";
  if (!["xlsx", "html", "htm"].includes(ext)) return "notstatement";
  if (file.size === 0) return "empty";
  return null;
}

// Response to error screen. Only the parser's own file codes may produce a message about
// the file; anything else (service down, timeout, 5xx, unknown) is a server error.
export function errorScreen(status: number | undefined, code: string | undefined): ErrKey {
  if (status === 429) return "ratelimit";
  if (status === 413 && code === "file_too_large") return "toolarge";
  if (status === 422) {
    switch (code) {
      case "mt4_file": return "mt4";
      case "empty_report": return "empty";
      case "not_a_report": return "notstatement";
    }
  }
  return "server";
}

export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function chips(r: ScoreResult): string[] {
  const months = Math.floor(r.history.months);
  return [
    r.account.account_type === "demo" ? "Demo account" : "Live account",
    plural(months, "month", "months"),
    plural(r.history.closed_trades, "trade", "trades"),
  ];
}

// "14 March 2027", from an ISO date, independent of the viewer's time zone.
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

export const DIAL_C = 2 * Math.PI * 88;
export function dash(score: number): string {
  return (DIAL_C * score / 100).toFixed(1) + " " + DIAL_C.toFixed(1);
}

export type PillarRow = { name: string; pct: string; score: number; w: string };
export function pillarRows(pillars: Pillar[]): PillarRow[] {
  return pillars.map((p) => {
    const s = roundHalfUp(p.score);
    return { name: p.name, pct: Math.round(p.weight * 100) + "%", score: s, w: s + "%" };
  });
}

export type ShortProgress = { label: string; value: string; w: string };
export function shortProgress(r: ScoreResult): ShortProgress[] {
  const months = Math.min(Math.floor(r.history.months), 3);
  const trades = Math.min(r.history.closed_trades, 30);
  return [
    { label: "Months of history", value: `${months} of 3`, w: Math.round((months / 3) * 100) + "%" },
    { label: "Closed trades", value: `${trades} of 30`, w: Math.round((trades / 30) * 100) + "%" },
  ];
}

export type PanelView = { kind: "none" } | {
  kind: "flags";
  summary: string | null;
  rows: { code: string; text: string; capping: boolean; showCapNote: boolean }[];
};

// The design's capping-panel sub-line, shown once, under the first capping row.
export const CAP_NOTE = "Martingale, grid trading or a blown account caps your score, whatever the profit.";

export function panelView(panel: RedFlagPanel | undefined): PanelView {
  if (!panel || panel.none || panel.rows.length === 0) return { kind: "none" };
  let noted = false;
  return {
    kind: "flags",
    summary: panel.summary,
    rows: panel.rows.map((row) => {
      const capping = row.cap !== null;
      const showCapNote = capping && !noted;
      if (showCapNote) noted = true;
      return { code: row.code, text: row.text, capping, showCapNote };
    }),
  };
}
