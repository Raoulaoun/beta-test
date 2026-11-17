// Applies pending migrations from ./drizzle. Bundled into one self-contained file
// (dist/migrate.cjs) for the image; run as Railway's pre-deploy command.
//
// First-admin bootstrap: if ADMIN_CREATE_EMAIL, ADMIN_CREATE_NAME, ADMIN_CREATE_PASSWORD
// and ADMIN_CREATE_TOTP_SECRET are set, the admin is created once (skipped if it exists).
// Nothing secret is printed. Remove those variables after the first deploy.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function bootstrapAdmin() {
  const { ADMIN_CREATE_EMAIL: email, ADMIN_CREATE_NAME: name, ADMIN_CREATE_PASSWORD: password, ADMIN_CREATE_TOTP_SECRET: secret } = process.env;
  if (!email || !name || !password || !secret) return;
  const { db, schema: s, closeDb } = await import("../lib/db/index.ts");
  const { createAdmin } = await import("../lib/server/adminAuth.ts");
  const { eq } = await import("drizzle-orm");
  try {
    const [existing] = await db().select({ id: s.adminUsers.id }).from(s.adminUsers).where(eq(s.adminUsers.email, email.trim().toLowerCase()));
    if (existing) { console.log("admin bootstrap: admin already exists, skipped"); return; }
    if (password.length < 16) throw new Error("ADMIN_CREATE_PASSWORD must be at least 16 characters");
    await createAdmin(email, name, password, secret.replace(/\s/g, "").toUpperCase());
    console.log("admin bootstrap: admin created");
  } finally {
    await closeDb();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR || "./drizzle" });
  } finally {
    await pool.end();
  }
  console.log("migrations applied");
  await bootstrapAdmin();
}

main().catch((err) => {
  console.error("migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
