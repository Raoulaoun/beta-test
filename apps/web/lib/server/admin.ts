// Admin CRM queries. Leads are accounts; each shows its latest result.
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";

export const STAGES = [
  ["new", "New"], ["contacted", "Contacted"], ["webinar_registered", "Webinar registered"],
  ["webinar_attended", "Webinar attended"], ["applied", "Applied"], ["not_a_fit", "Not a fit"],
] as const;
export type StageCode = (typeof STAGES)[number][0];
export const stageLabel = (c: string) => STAGES.find(([k]) => k === c)?.[1] ?? c;
export const stageCode = (label: string) => STAGES.find(([, l]) => l === label)?.[0];

export const BANDS = [["professional_grade", "Professional Grade"], ["emerging_manager", "Emerging Manager"], ["building", "Building"], ["developing", "Developing"]] as const;
export const bandLabel = (c: string | null) => (c ? BANDS.find(([k]) => k === c)?.[1] ?? c : "—");
export const MANAGE_LABEL: Record<string, string> = { no: "No", friends_family: "Yes, friends and family", formal: "Yes, formally" };

// Short labels for the "Top weakness" column. Pending approved wording: advice-text headings.
export const WEAKNESS_LABEL: Record<string, string> = {
  max_drawdown: "Max drawdown", worst_day: "Worst day", avg_loss: "Average loss per trade", stop_usage: "Stop loss usage",
  revenge_sizing: "Revenge sizing", adding_to_losers: "Adding to losers", hold_asymmetry: "Holding losers", overtrading: "Overtrading",
  profitable_months: "Profitable months", top5_share: "Profit from a few trades", best_month_share: "Best month",
  return_to_drawdown: "Return compared with drawdown", sortino: "Sortino ratio", profit_factor: "Profit factor",
  months_history: "Months of history", closed_trades: "Number of trades", days_since_last: "Recent activity",
};
export const LEFT_AT_LABEL: Record<string, string> = { score: "Score", pillars: "Pillars", lead_form: "Lead form", exit_prompt: "Exit prompt" };

export type LeadFilters = { band?: string; min?: number; campaign?: string; stage?: string; days?: number };

// Latest result per account (attached results only; pending ones wait for sign-in).
const latest = () => db().$with("latest").as(
  db().selectDistinctOn([s.results.accountId], {
    accountId: s.results.accountId, score: s.results.score, band: s.results.band, scoreType: s.results.scoreType,
    topWeakness: s.results.topWeakness, broker: s.results.broker, campaign: s.results.campaign, createdAt: s.results.createdAt,
  }).from(s.results).where(sql`${s.results.accountId} is not null`).orderBy(s.results.accountId, desc(s.results.createdAt)),
);

export async function listLeads(f: LeadFilters = {}) {
  const l = latest();
  const conds = [];
  if (f.band) conds.push(eq(l.band, f.band));
  if (f.min !== undefined && !Number.isNaN(f.min)) conds.push(gte(l.score, f.min));
  if (f.campaign) conds.push(eq(l.campaign, f.campaign));
  if (f.stage) conds.push(eq(s.crm.stage, f.stage as StageCode));
  if (f.days) conds.push(gte(s.accounts.createdAt, new Date(Date.now() - f.days * 86_400_000)));
  return db().with(l).select({
    id: s.accounts.id, name: s.accounts.name, email: s.accounts.email, phone: s.accounts.phone,
    managing: s.accounts.managingForOthers, createdAt: s.accounts.createdAt, stage: s.crm.stage,
    score: l.score, band: l.band, scoreType: l.scoreType, topWeakness: l.topWeakness, broker: l.broker, campaign: l.campaign,
  }).from(s.accounts)
    .leftJoin(s.crm, eq(s.crm.accountId, s.accounts.id))
    .leftJoin(l, eq(l.accountId, s.accounts.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.accounts.createdAt));
}

export async function countLeads(): Promise<number> {
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.accounts);
  return n;
}

export async function campaigns(): Promise<string[]> {
  const rows = await db().selectDistinct({ c: s.results.campaign }).from(s.results).where(sql`${s.results.campaign} is not null`).orderBy(s.results.campaign);
  return rows.map((r) => r.c!).filter(Boolean);
}

export async function leadDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [a] = await db().select().from(s.accounts).where(eq(s.accounts.id, id));
  if (!a) return null;
  const [crm] = await db().select().from(s.crm).where(eq(s.crm.accountId, id));
  const results = await db().select().from(s.results)
    .where(sql`${s.results.accountId} = ${id} or ${s.results.pendingAccountId} = ${id}`).orderBy(desc(s.results.createdAt));
  const notes = await db().select().from(s.crmNotes).where(eq(s.crmNotes.accountId, id)).orderBy(desc(s.crmNotes.createdAt));
  const emails = await db().select().from(s.emailLog).where(eq(s.emailLog.accountId, id)).orderBy(desc(s.emailLog.createdAt));
  return { account: a, stage: crm?.stage ?? "new", results, notes, emails };
}

export async function setStage(accountId: string, stage: StageCode) {
  await db().insert(s.crm).values({ accountId, stage, stageUpdatedAt: new Date() })
    .onConflictDoUpdate({ target: s.crm.accountId, set: { stage, stageUpdatedAt: new Date() } });
}

export async function addNote(accountId: string, author: string, body: string) {
  await db().insert(s.crmNotes).values({ accountId, author, body: body.slice(0, 4000) });
}

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

export async function funnel(days = 30) {
  const rows = await db().select({ kind: s.funnelEvents.kind, campaign: s.funnelEvents.campaign, n: sql<number>`count(*)::int` })
    .from(s.funnelEvents).where(gte(s.funnelEvents.createdAt, since(days)))
    .groupBy(s.funnelEvents.kind, s.funnelEvents.campaign);
  const by = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = r.campaign ?? "Organic";
    by.set(key, { ...(by.get(key) ?? {}), [r.kind]: r.n });
  }
  return [...by.entries()].map(([campaign, k]) => ({
    campaign, visits: k.visit ?? 0, uploads: k.upload_started ?? 0, scored: k.score_shown ?? 0, leads: k.lead_submitted ?? 0,
    exitShown: k.exit_prompt_shown ?? 0, exitRecovered: k.exit_prompt_converted ?? 0,
  })).sort((a, b) => b.visits - a.visits || a.campaign.localeCompare(b.campaign));
}

export async function dropoffs(days = 30) {
  const list = await db().select({
    id: s.results.id, createdAt: s.results.createdAt, score: s.results.score, band: s.results.band, scoreType: s.results.scoreType,
    topWeakness: s.results.topWeakness, campaign: s.results.campaign, device: s.results.device, leftAt: s.results.leftAt,
  }).from(s.results)
    .where(and(isNull(s.results.accountId), isNull(s.results.pendingAccountId), isNull(s.results.convertedAt), gte(s.results.createdAt, since(days))))
    .orderBy(desc(s.results.createdAt)).limit(500);
  return list;
}

export async function dropoffCount(days = 30): Promise<number> {
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.results)
    .where(and(isNull(s.results.accountId), isNull(s.results.pendingAccountId), isNull(s.results.convertedAt), gte(s.results.createdAt, since(days))));
  return n;
}

export { inArray };
