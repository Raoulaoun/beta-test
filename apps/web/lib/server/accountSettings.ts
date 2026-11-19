// Settings (design/account): your details (name, WhatsApp number; the email is shown but
// can't be changed in v1), email preferences (retest reminder, monthly check-up, updates
// from Beta). Deleting the account is DELETE /api/account.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { mobileNumber, retestDays } from "./leads.ts";

export type SettingsInput = { name?: string; cc?: string; phone?: string; retest_reminders?: boolean; updates?: boolean; monthly_checkup?: boolean };

// The picker codes the form offers, longest first so "+961" wins over "+9…" prefixes.
const CODES = ["+961", "+971", "+966", "+974", "+965", "+962", "+20", "+33", "+44", "+1"];
export function splitPhone(e164: string | null): { cc: string; phone: string } {
  if (!e164) return { cc: "+961", phone: "" };
  const cc = [...CODES].sort((a, b) => b.length - a.length).find((c) => e164.startsWith(c)) ?? "+961";
  return { cc, phone: e164.slice(cc.length) };
}

async function latestBand(accountId: string) {
  const [r] = await db().select({ band: s.results.band, at: s.results.createdAt }).from(s.results)
    .where(and(eq(s.results.accountId, accountId), inArray(s.results.scoreType, ["full", "early", "starter"])))
    .orderBy(desc(s.results.createdAt)).limit(1);
  return r ?? null;
}

export async function getSettings(accountId: string) {
  const [a] = await db().select().from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return null;
  const latest = await latestBand(accountId);
  return { email: a.email, name: a.name ?? "", ...splitPhone(a.phone),
    retest_reminders: a.retestReminders, updates: a.consentMarketing, monthly_checkup: a.monthlyCheckup,
    retest_days: retestDays(latest?.band), retest_reminder_at: a.retestReminderAt?.toISOString() ?? null };
}

export type SettingsOutcome = { ok: true; settings: Awaited<ReturnType<typeof getSettings>> } | { ok: false; fields: ("name" | "phone")[] };

export async function updateSettings(accountId: string, v: SettingsInput): Promise<SettingsOutcome | null> {
  const [a] = await db().select().from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return null;
  const set: Partial<typeof s.accounts.$inferInsert> = { updatedAt: new Date() };
  const fields: ("name" | "phone")[] = [];
  if (v.name !== undefined) {
    const name = v.name.trim();
    if (!name || name.length > 120) fields.push("name"); else set.name = name;
  }
  if (v.phone !== undefined || v.cc !== undefined) {
    const m = mobileNumber(v.cc ?? splitPhone(a.phone).cc, v.phone ?? splitPhone(a.phone).phone);
    if (!m) fields.push("phone"); else { set.phone = m.phone; set.country = m.country; }
  }
  if (fields.length) return { ok: false, fields };
  if (typeof v.updates === "boolean") set.consentMarketing = v.updates;
  if (typeof v.monthly_checkup === "boolean") set.monthlyCheckup = v.monthly_checkup;
  if (typeof v.retest_reminders === "boolean") {
    set.retestReminders = v.retest_reminders;
    if (!v.retest_reminders) set.retestReminderAt = null;
    else if (!a.retestReminderAt) {
      // Turned back on: the reminder comes the band's retest days after the latest result.
      const latest = await latestBand(accountId);
      const from = latest?.at ?? new Date();
      set.retestReminderAt = new Date(Math.max(from.getTime() + retestDays(latest?.band) * 86_400_000, Date.now() + 86_400_000));
    }
  }
  await db().update(s.accounts).set(set).where(eq(s.accounts.id, accountId));
  return { ok: true, settings: await getSettings(accountId) };
}
