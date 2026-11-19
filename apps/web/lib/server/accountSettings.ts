// Settings for a signed-in account: email choices (retest reminder, updates from Beta,
// monthly check-up). Deleting the account is /api/account. No email change in v1.
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "../db/index.ts";
import { RETEST_DAYS } from "./leads.ts";

export type EmailChoices = { retest_reminders: boolean; updates: boolean; monthly_checkup: boolean };

export async function getSettings(accountId: string) {
  const [a] = await db().select().from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return null;
  return { email: a.email, name: a.name, retest_reminders: a.retestReminders, updates: a.consentMarketing,
    monthly_checkup: a.monthlyCheckup, retest_reminder_at: a.retestReminderAt?.toISOString() ?? null };
}

export async function updateSettings(accountId: string, v: Partial<EmailChoices>) {
  const [a] = await db().select().from(s.accounts).where(eq(s.accounts.id, accountId));
  if (!a) return null;
  const set: Partial<typeof s.accounts.$inferInsert> = { updatedAt: new Date() };
  if (typeof v.updates === "boolean") set.consentMarketing = v.updates;
  if (typeof v.monthly_checkup === "boolean") set.monthlyCheckup = v.monthly_checkup;
  if (typeof v.retest_reminders === "boolean") {
    set.retestReminders = v.retest_reminders;
    if (!v.retest_reminders) set.retestReminderAt = null;
    else if (!a.retestReminderAt) {
      // Turned back on: the reminder comes RETEST_DAYS after the latest result.
      const [latest] = await db().select({ at: s.results.createdAt }).from(s.results)
        .where(and(eq(s.results.accountId, accountId), inArray(s.results.scoreType, ["full", "early", "starter"])))
        .orderBy(desc(s.results.createdAt)).limit(1);
      const from = latest?.at ?? new Date();
      set.retestReminderAt = new Date(Math.max(from.getTime() + RETEST_DAYS * 86_400_000, Date.now() + 86_400_000));
    }
  }
  await db().update(s.accounts).set(set).where(eq(s.accounts.id, accountId));
  return getSettings(accountId);
}
