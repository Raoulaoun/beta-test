import { and, eq, isNull, lt } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import type { ScoreResult } from "../types.ts";
import { newToken, sameHash, sha256 } from "./crypto.ts";
import type { Attribution } from "./attribution.ts";

export const SAVED_RESULT_DAYS = 30;     // a browser can reopen its own result for 30 days
export const DROPOFF_RETENTION_DAYS = 90; // anonymous results without a lead are deleted after 90 days
const LEFT_AT_ORDER = ["score", "pillars", "lead_form", "exit_prompt"] as const;
export type LeftAt = (typeof LEFT_AT_ORDER)[number];

type EngineResult = ScoreResult & {
  account: ScoreResult["account"] & { account_masked?: string | null; fingerprint?: string | null };
  top_fixes?: { metric: string }[];
  uncapped_score?: number;
};

// What is kept of a result: everything shown, minus the masked account number and the
// fingerprint (which lives in its own column). Never the statement, never trades.
export function storedPayload(r: EngineResult): ScoreResult {
  const { account_masked: _m, fingerprint: _f, ...account } = r.account;
  return { ...r, account } as ScoreResult;
}

function metricValues(r: EngineResult): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const p of r.pillars ?? []) for (const m of (p as unknown as { metrics: { key: string; value: number | null }[] }).metrics ?? []) out[m.key] = m.value;
  return out;
}

export async function saveResult(r: EngineResult, ctx: Attribution & { device: string; accountId?: string | null }) {
  const accessToken = newToken();
  const [row] = await db().insert(s.results).values({
    accountId: ctx.accountId ?? null,
    accessTokenHash: sha256(accessToken),
    source: "upload",
    accountFingerprint: r.account.fingerprint ?? null,
    platform: r.account.platform ?? "MT5",
    scoreType: r.score_type,
    score: r.score,
    uncappedScore: r.uncapped_score ?? null,
    band: r.band?.code ?? null,
    pillars: (r.pillars ?? []).map((p) => ({ key: p.key, score: p.score })),
    metrics: metricValues(r),
    redFlags: (r as unknown as { red_flags?: { code: string }[] }).red_flags?.map((f) => f.code) ?? [],
    notes: r.notes ?? [],
    topWeakness: r.top_fixes?.[0]?.metric ?? (r.headline?.kind === "weakness" ? r.headline.metric : null),
    broker: r.account.broker,
    accountType: r.account.account_type,
    sizeBucket: r.account.size_bucket,
    months: String(r.history.months),
    closedTrades: r.history.closed_trades,
    periodDays: r.period?.days ?? null,
    evaluationDate: r.evaluation_date,
    scoringVersion: r.scoring_version,
    payload: storedPayload(r),
    campaign: ctx.campaign,
    utm: ctx.utm,
    introducedBy: ctx.introducedBy,
    device: ctx.device,
    leftAt: "score",
    convertedAt: ctx.accountId ? new Date() : null,
  }).returning({ id: s.results.id });
  return { id: row.id, accessToken };
}

async function owned(id: string, token: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !token) return null;
  const [row] = await db().select().from(s.results).where(eq(s.results.id, id));
  if (!row || !sameHash(row.accessTokenHash, sha256(token))) return null;
  return row;
}

// The uploading browser reopens its result (saved result, 30 days, until converted).
export async function reopenResult(id: string, token: string) {
  const row = await owned(id, token);
  if (!row) return null;
  if (Date.now() - row.createdAt.getTime() > SAVED_RESULT_DAYS * 86_400_000) return null;
  return { payload: row.payload as ScoreResult, converted: !!row.convertedAt };
}

export async function recordProgress(id: string, token: string, step: LeftAt) {
  const row = await owned(id, token);
  if (!row) return false;
  const before = LEFT_AT_ORDER.indexOf((row.leftAt as LeftAt) ?? "score");
  const now = LEFT_AT_ORDER.indexOf(step);
  await db().update(s.results).set({
    leftAt: now > before ? step : row.leftAt,
    exitPromptShown: row.exitPromptShown || step === "exit_prompt",
  }).where(eq(s.results.id, id));
  if (step === "exit_prompt" && !row.exitPromptShown) {
    await recordEvent("exit_prompt_shown", { campaign: row.campaign, resultId: row.id, device: row.device });
  }
  return true;
}

export async function recordEvent(kind: (typeof s.funnelKindEnum.enumValues)[number],
  e: { campaign?: string | null; resultId?: string | null; device?: string | null } = {}) {
  await db().insert(s.funnelEvents).values({ kind, campaign: e.campaign ?? null, resultId: e.resultId ?? null, device: e.device ?? null });
}

// Anonymous results with no lead after 90 days are deleted; funnel counts stay.
export async function deleteStaleDropoffs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DROPOFF_RETENTION_DAYS * 86_400_000);
  const gone = await db().delete(s.results)
    .where(and(isNull(s.results.accountId), isNull(s.results.convertedAt), lt(s.results.createdAt, cutoff)))
    .returning({ id: s.results.id });
  return gone.length;
}

export { owned as ownedResult };
