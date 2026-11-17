import { sql } from "drizzle-orm";
import { db } from "../../lib/db/index.ts";

export const TEST_DB = "postgres://postgres:dev@127.0.0.1:5432/managertest_test";
process.env.DATABASE_URL ||= TEST_DB;
if (!process.env.DATABASE_URL.endsWith("_test")) throw new Error("DB tests only run against a *_test database");

export async function resetDb(): Promise<void> {
  const tables = ["result_insights", "goals", "crm_notes", "crm", "email_log", "auth_tokens", "sessions",
    "results", "accounts", "admin_sessions", "admin_login_attempts", "admin_users", "funnel_events", "site_settings"];
  await db().execute(sql.raw(`truncate ${tables.join(", ")} restart identity cascade`));
}
