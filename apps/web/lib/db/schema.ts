// Database schema. Design rules (CLAUDE.md):
// - an account has many results (score history); every result stores its evaluation date
//   and scoring version;
// - insights are stored per result as segment aggregates only, never individual trades;
// - deleting an account deletes its results and insights (ON DELETE CASCADE throughout);
// - never the statement, never the account number (only an HMAC fingerprint);
// - results carry a source: "upload" now, "connected" in version 2.
import { sql } from "drizzle-orm";
import {
  bigint, bigserial, boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text,
  timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts("created_at").notNull().defaultNow();

export const managingEnum = pgEnum("managing_for_others", ["no", "friends_family", "formal"]);
export const stageEnum = pgEnum("crm_stage", ["new", "contacted", "webinar_registered", "webinar_attended", "applied", "not_a_fit"]);
export const sourceEnum = pgEnum("result_source", ["upload", "connected"]);
export const scoreTypeEnum = pgEnum("score_type", ["full", "early", "starter"]);
export const goalKindEnum = pgEnum("goal_kind", ["pillar", "band"]);
export const funnelKindEnum = pgEnum("funnel_kind", [
  "visit", "upload_started", "score_shown", "lead_submitted", "exit_prompt_shown", "exit_prompt_converted",
  "form_opened",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),                       // stored lower-cased
  name: text("name"),
  phone: text("phone"),                                 // E.164
  country: text("country"),                             // ISO 3166 alpha-2, from the phone number
  managingForOthers: managingEnum("managing_for_others"),
  consentContact: boolean("consent_contact").notNull().default(false),
  consentMarketing: boolean("consent_marketing").notNull().default(false),
  source: jsonb("source").$type<{ utm?: Record<string, string>; landing?: string }>(),
  introducedBy: text("introduced_by"),
  retestReminderAt: ts("retest_reminder_at"),
  // Settings (email choices). Updates from Beta is consentMarketing.
  retestReminders: boolean("retest_reminders").notNull().default(false),
  monthlyCheckup: boolean("monthly_checkup").notNull().default(true),
  lastSignInAt: ts("last_sign_in_at"),
  createdAt: created(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("accounts_email_key").on(t.email)]);

export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }), // null while anonymous
  accessTokenHash: text("access_token_hash").notNull(), // lets the uploading browser reopen its own result
  // A lead sent with an email that already has an account, by someone not signed in as it:
  // the result waits here until the owner signs in through their email link.
  pendingAccountId: uuid("pending_account_id").references(() => accounts.id, { onDelete: "cascade" }),
  source: sourceEnum("source").notNull().default("upload"),
  connectedAccountId: uuid("connected_account_id"),     // version 2: the linked trading account
  accountFingerprint: text("account_fingerprint"),      // HMAC of number + server; groups a trading account
  platform: text("platform").notNull(),                 // MT4 | MT5
  scoreType: scoreTypeEnum("score_type").notNull(),
  score: integer("score"),
  uncappedScore: integer("uncapped_score"),
  band: text("band"),                                   // band code, e.g. emerging_manager
  pillars: jsonb("pillars").$type<{ key: string; score: number }[]>(),
  metrics: jsonb("metrics").$type<Record<string, number | null>>(),
  redFlags: jsonb("red_flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notes: jsonb("notes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  topWeakness: text("top_weakness"),                    // metric key of the headline
  broker: text("broker"),
  accountType: text("account_type").notNull(),          // live | demo
  sizeBucket: text("size_bucket"),
  months: numeric("months", { precision: 6, scale: 2 }),
  closedTrades: integer("closed_trades").notNull(),
  periodDays: integer("period_days"),
  evaluationDate: date("evaluation_date").notNull(),
  scoringVersion: text("scoring_version").notNull(),
  payload: jsonb("payload").notNull(),                  // the result as shown (no account number, no trades)
  campaign: text("campaign"),
  utm: jsonb("utm").$type<Record<string, string>>(),
  introducedBy: text("introduced_by"),
  device: text("device"),                               // iPhone | Android | Desktop
  leftAt: text("left_at"),                              // furthest point reached: score | pillars | lead_form | exit_prompt
  exitPromptShown: boolean("exit_prompt_shown").notNull().default(false),
  convertedAt: ts("converted_at"),
  createdAt: created(),
}, (t) => [
  index("results_account_idx").on(t.accountId, t.createdAt),
  index("results_fingerprint_idx").on(t.accountFingerprint),
  index("results_dropoff_idx").on(t.createdAt).where(sql`${t.accountId} is null`),
]);

export const resultInsights = pgTable("result_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  resultId: uuid("result_id").notNull().references(() => results.id, { onDelete: "cascade" }),
  area: text("area").notNull(),                         // session | hour | weekday | instrument | …
  segment: text("segment"),
  polarity: text("polarity").notNull(),                 // working | costing
  trades: integer("trades"),
  share: numeric("share", { precision: 7, scale: 4 }),
  pfWithout: numeric("pf_without", { precision: 9, scale: 4 }),
  data: jsonb("data"),                                  // other aggregates; never individual trades
  rank: integer("rank").notNull(),
}, (t) => [index("result_insights_result_idx").on(t.resultId)]);

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  kind: goalKindEnum("kind").notNull(),
  pillar: text("pillar"),                               // kind = pillar
  target: integer("target"),                            // kind = pillar: 0–100
  band: text("band"),                                   // kind = band
  baselineResultId: uuid("baseline_result_id").references(() => results.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  achievedAt: ts("achieved_at"),
  achievedResultId: uuid("achieved_result_id").references(() => results.id, { onDelete: "set null" }),
  createdAt: created(),
}, (t) => [uniqueIndex("goals_one_active_idx").on(t.accountId).where(sql`${t.active}`)]);

// A browser that has signed in to (or created) an account: lets the results screen offer
// "Send me a sign-in link" without the browser keeping the email. Only the token's hash.
export const knownDevices = pgTable("known_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("known_devices_token_key").on(t.tokenHash)]);

export const crm = pgTable("crm", {
  accountId: uuid("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
  stage: stageEnum("stage").notNull().default("new"),
  stageUpdatedAt: ts("stage_updated_at").notNull().defaultNow(),
});

export const crmNotes = pgTable("crm_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  body: text("body").notNull(),
  createdAt: created(),
}, (t) => [index("crm_notes_account_idx").on(t.accountId, t.createdAt)]);

export const emailLog = pgTable("email_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  subject: text("subject"),
  status: text("status").notNull(),                     // scheduled | sent | opened | failed
  scheduledFor: ts("scheduled_for"),
  sentAt: ts("sent_at"),
  providerId: text("provider_id"),
  createdAt: created(),
}, (t) => [index("email_log_account_idx").on(t.accountId, t.createdAt)]);

export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),                       // for the per-email rate limit
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: created(),
}, (t) => [uniqueIndex("auth_tokens_hash_key").on(t.tokenHash), index("auth_tokens_email_idx").on(t.email, t.createdAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("sessions_hash_key").on(t.tokenHash)]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),        // scrypt
  totpSecretEnc: text("totp_secret_enc").notNull(),     // AES-256-GCM with ADMIN_TOTP_KEY
  lastTotpStep: bigint("last_totp_step", { mode: "number" }),   // replay guard
  createdAt: created(),
}, (t) => [uniqueIndex("admin_users_email_key").on(t.email)]);

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("admin_sessions_hash_key").on(t.tokenHash)]);

export const adminLoginAttempts = pgTable("admin_login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  ok: boolean("ok").notNull(),
  createdAt: created(),
}, (t) => [index("admin_login_attempts_idx").on(t.email, t.createdAt)]);

// Anonymous counts. No foreign key: counts survive result deletion; no personal data.
export const funnelEvents = pgTable("funnel_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: funnelKindEnum("kind").notNull(),
  campaign: text("campaign"),
  resultId: uuid("result_id"),
  device: text("device"),
  // form_opened: which button opened the lead form (results_button, exit_prompt, coach_more,
  // signed_out_banner). Joined to lead_submitted on result_id to compare entries.
  source: text("source"),
  createdAt: created(),
}, (t) => [index("funnel_events_idx").on(t.kind, t.createdAt)]);

// Values the team can change without a deploy (confirmation-screen links).
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

