// Shape of the scoring service's /score response (services/scoring/manager_test/engine.py).

export type PanelRow = { code: string; text: string; cap: number | null };

export type RedFlagPanel = {
  none: boolean;
  none_text: string | null;
  summary: string | null;
  rows: PanelRow[];
  cap_applied: number | null;
};

export type Pillar = { key: string; name: string; weight: number; score: number };

export type ScoreType = "full" | "early" | "starter";

// Coach insight (scoring service, manager_test/coach.py). Segment aggregates only.
export type CoachFinding = {
  area: string; polarity: "working" | "costing"; segment: string | null; trades: number;
  share: number | null; pf_without: number | null; impact: number; rank: number;
  text: string; action: string | null; data: Record<string, unknown>;
};
// What the browser gets: the free top "working" and top "costing" finding only.
export type CoachTop = { top: { working: CoachFinding | null; costing: CoachFinding | null } };

export type StarterMetric = {
  key: string; name: string; display: string; score: number;
  kind: "advice" | "strength"; text: string; actions?: string[];
};

export type ScoreResult = {
  scoring_version: string;
  evaluation_date: string;
  score_type: ScoreType;
  status: ScoreType;
  score: number | null;
  band: { code: string; name: string; meaning: string } | null;
  account: { account_type: "live" | "demo"; size_bucket: string; broker: string | null; platform?: "MT4" | "MT5" };
  history: { months: number; closed_trades: number };
  headline: { kind: string; metric: string; text: string } | null;
  pillars: Pillar[] | null;
  red_flag_panel?: RedFlagPanel | null;
  period: { start: string; end: string; days: number; label: string };
  nudge: string | null;
  progress: { key: "months" | "trades"; current: number; target: number }[] | null;
  early: { label: string; line: string; cap: number } | null;
  starter: { heading: string; line: string; metrics: StarterMetric[] } | null;
  retest_default: boolean;
  notes: string[];
  coach?: CoachTop | null;
  // Added by the web app's /api/score
  result_id?: string;
  access_token?: string;
  saved_to_account?: boolean;
};

export type ScoreError = { error: string; message?: string; hint?: string };

// Error screens: file problems, plus two that never blame the file. Copy for all of them:
// docs/advice-texts.md, "Upload errors and result notes".
export type FileErrKey = "empty" | "notstatement" | "toolarge";
export type ServiceErrKey = "server" | "ratelimit";
export type ErrKey = FileErrKey | ServiceErrKey;
