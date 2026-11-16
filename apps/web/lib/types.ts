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

export type ScoreResult = {
  scoring_version: string;
  evaluation_date: string;
  status: "scored" | "not_enough_history";
  score: number | null;
  band: { code: string; name: string; meaning: string };
  account: { account_type: "live" | "demo"; size_bucket: string; broker: string | null };
  history: { months: number; closed_trades: number };
  headline: { kind: string; metric: string; text: string } | null;
  pillars: Pillar[] | null;
  red_flag_panel?: RedFlagPanel;
  come_back_date: string | null;
  notes: string[];
};

export type ScoreError = { error: string; message?: string; hint?: string };

// Error screens in the design (design/flow: err = mt4 | empty | notstatement | toolarge).
export type ErrKey = "mt4" | "empty" | "notstatement" | "toolarge";
