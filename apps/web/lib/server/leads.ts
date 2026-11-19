// Lead form: validate, then create the account (new email) or hold the result for the
// existing account until its owner signs in. Never overwrites someone else's profile.
import { eq } from "drizzle-orm";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { db, schema as s } from "../db/index.ts";
import { ownedResult, recordEvent } from "./results.ts";

export const MANAGE: Record<string, "no" | "friends_family" | "formal"> = {
  "No": "no", "Yes, friends and family": "friends_family", "Yes, formally": "formal",
};
export const RETEST_DAYS = 60;
// docs/spec.md follow-up: Developing retests at 90 days, every other band at 60.
export const retestDays = (band: string | null | undefined) => (band === "developing" ? 90 : RETEST_DAYS);

export type LeadInput = {
  result_id: string; token: string; name: string; email: string; cc: string; phone: string;
  manage: string; consent: boolean; updates: boolean; remind: boolean;
};
export type FieldErrors = Partial<Record<"name" | "email" | "phone" | "manage" | "consent", true>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The form's country picker (design/flow): the chosen code's country wins over regions
// that share a calling code (+44 also covers GG, JE, IM; +1 covers CA and others).
const PICKER_COUNTRY: Record<string, string> = {
  "+961": "LB", "+971": "AE", "+966": "SA", "+974": "QA", "+965": "KW",
  "+962": "JO", "+20": "EG", "+33": "FR", "+44": "GB", "+1": "US",
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// A WhatsApp number from the picker's code and the typed number: E.164 and country, or null.
export function mobileNumber(cc: string, phone: string): { phone: string; country: string } | null {
  const parsed = parsePhoneNumberFromString(`${cc || ""}${(phone || "").replace(/[^\d]/g, "")}`);
  const type = parsed?.getType();
  if (!parsed || !parsed.isValid() || !(type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE")) return null;
  return { phone: parsed.number, country: PICKER_COUNTRY[cc] ?? parsed.country ?? "" };
}

// The browser shows the design's messages; the server only says which fields failed.
export function validateLead(v: LeadInput): { errors: FieldErrors; phone?: string; country?: string } {
  const errors: FieldErrors = {};
  if (!v.name?.trim() || v.name.trim().length > 120) errors.name = true;
  const email = normaliseEmail(v.email || "");
  if (!EMAIL.test(email) || email.length > 254) errors.email = true;
  const mobile = mobileNumber(v.cc, v.phone);
  if (!mobile) errors.phone = true;
  if (!(v.manage in MANAGE)) errors.manage = true;
  if (v.consent !== true) errors.consent = true;
  return { errors, phone: mobile?.phone, country: mobile?.country };
}

export type LeadOutcome =
  | { kind: "invalid"; errors: FieldErrors }
  | { kind: "no_result" }
  | { kind: "ok"; accountId: string; created: boolean; pending: boolean; email: string };

export async function submitLead(v: LeadInput, signedInAccountId: string | null): Promise<LeadOutcome> {
  const { errors, phone, country } = validateLead(v);
  if (Object.keys(errors).length) return { kind: "invalid", errors };
  const result = await ownedResult(v.result_id, v.token);
  if (!result) return { kind: "no_result" };
  const email = normaliseEmail(v.email);
  const now = new Date();

  return db().transaction(async (tx) => {
    const [existing] = await tx.select().from(s.accounts).where(eq(s.accounts.email, email));
    let accountId: string, created = false, pending = false;
    const profile = {
      name: v.name.trim(), phone, country, managingForOthers: MANAGE[v.manage],
      consentContact: true, consentMarketing: !!v.updates,
      retestReminderAt: v.remind ? new Date(now.getTime() + retestDays(result.band) * 86_400_000) : null,
      retestReminders: !!v.remind,
      updatedAt: now,
    };
    if (!existing) {
      const [a] = await tx.insert(s.accounts).values({
        email, ...profile, introducedBy: result.introducedBy,
        source: { utm: result.utm ?? undefined, landing: result.campaign ?? undefined },
      }).returning({ id: s.accounts.id });
      await tx.insert(s.crm).values({ accountId: a.id });
      accountId = a.id;
      created = true;
    } else if (existing.id === signedInAccountId) {
      await tx.update(s.accounts).set(profile).where(eq(s.accounts.id, existing.id));
      accountId = existing.id;
    } else {
      accountId = existing.id;
      pending = true; // joins this account's history once its owner signs in
    }
    await tx.update(s.results).set(pending
      ? { pendingAccountId: accountId, convertedAt: result.convertedAt ?? now }
      : { accountId, pendingAccountId: null, convertedAt: result.convertedAt ?? now })
      .where(eq(s.results.id, result.id));
    return { kind: "ok" as const, accountId, created, pending, email };
  }).then(async (out) => {
    if (!result.convertedAt) {
      await recordEvent("lead_submitted", { campaign: result.campaign, resultId: result.id, device: result.device });
      if (result.exitPromptShown) await recordEvent("exit_prompt_converted", { campaign: result.campaign, resultId: result.id, device: result.device });
    }
    return out;
  });
}
