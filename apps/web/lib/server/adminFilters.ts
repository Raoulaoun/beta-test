import type { LeadFilters } from "./admin.ts";
import { BANDS, STAGES } from "./admin.ts";

export function parseFilters(q: Record<string, string | string[] | undefined> | URLSearchParams): LeadFilters {
  const get = (k: string) => (q instanceof URLSearchParams ? q.get(k) : (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined))) || "";
  const band = get("band"), stage = get("stage"), days = Number(get("days")), min = get("min");
  return {
    band: BANDS.some(([k]) => k === band) ? band : undefined,
    stage: STAGES.some(([k]) => k === stage) ? stage : undefined,
    campaign: get("campaign") || undefined,
    days: [1, 3, 7].includes(days) ? days : undefined,
    min: min !== "" && Number.isFinite(Number(min)) ? Math.max(0, Math.min(100, Number(min))) : undefined,
  };
}

// Spreadsheet formula injection guard: a cell can't start with = + - @ or a control char.
export function csvCell(v: unknown): string {
  let x = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(x)) x = `'${x}`;
  return `"${x.replace(/"/g, '""')}"`;
}
