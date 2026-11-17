import type { ErrKey, Pillar, RedFlagPanel, ScoreResult } from "./types.ts";

// docs/advice-texts.md, "Upload errors and result notes", word for word. The error card
// shows the first sentence as its title and the rest below it.
export const ERROR_LINES: Record<ErrKey, string> = {
  notstatement: "We couldn't read this file. Upload the statement exported from MT4 or MT5. The guide below shows how.",
  empty: "This statement has no closed trades. Choose All History, export again and upload the new file.",
  toolarge: "This file is over 10 MB. Export only your account history and try again.",
  ratelimit: "You've tested several files in a short time. Please try again in an hour.",
  server: "Something went wrong on our side. Please try again in a minute.",
};

export function errorCopy(key: ErrKey): [string, string | null] {
  const line = ERROR_LINES[key];
  const i = line.indexOf(". ");
  return i < 0 ? [line, null] : [line.slice(0, i + 1), line.slice(i + 2)];
}

export const isFileError = (key: ErrKey) => key !== "server" && key !== "ratelimit";

// docs/advice-texts.md, "Early score, starter read and MT4 copy", word for word.
export const COPY = {
  dropMain: "Drop your MT4 or MT5 statement here",
  dropFormats: "MT5: XLSX or HTML report · MT4: HTML statement · up to 10 MB",
  landingSubline: "Upload your MT4 or MT5 statement and get your Manager-Readiness score, judged the way an investor would judge you: risk and discipline first, returns last.",
  retest: "Remind me to retest in 60 days.",
  mt4Steps: [
    "Open the Terminal (Ctrl+T) and click the Account History tab.",
    "Right-click the list and choose All History, so every trade is included.",
    "Right-click again and choose Save as Detailed Report (or Save as Report), then save the file.",
    "Upload the saved file here.",
  ],
};

export const MAX_BYTES = 10 * 1024 * 1024;

// Client-side checks, in the design's order (design/flow handleFile).
export function precheck(file: { name: string; size: number }): ErrKey | null {
  const n = file.name || "statement";
  const ext = (n.split(".").pop() || "").toLowerCase();
  if (file.size > MAX_BYTES) return "toolarge";
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

// Starter reads leave out the months chip: under 5 trades it mostly reads "0 months".
export function starterChips(r: ScoreResult): string[] {
  const [account, , trades] = chips(r);
  return [account, trades];
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

export type ProgressRow = { label: string; value: string; w: string };
export function progressRows(r: ScoreResult): ProgressRow[] {
  return (r.progress ?? []).map((p) => ({
    label: p.key === "months" ? "Months of history" : "Closed trades",
    value: `${p.current} of ${p.target}`,
    w: Math.round((p.current / p.target) * 100) + "%",
  }));
}

// The nudge, split so "Export again…" can link to the export guide.
export function nudgeParts(text: string): [string, string] {
  const i = text.indexOf("Export again");
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i)];
}

export type PanelView = { kind: "none" } | {
  kind: "flags";
  summary: string | null;
  rows: { code: string; text: string; capping: boolean; showCapNote: boolean }[];
};

// The design's capping-panel sub-line, shown once, under the first capping row.
export const CAP_NOTE = "Martingale, grid trading or a blown account caps your score, whatever the profit.";

export function panelView(panel: RedFlagPanel | null | undefined): PanelView {
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
