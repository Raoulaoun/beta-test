import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export type DB = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let instance: DB | null = null;

// One pool per process, created on first use (never at build time).
export function db(): DB {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString: url, max: 10 });
    instance = drizzle(pool, { schema });
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  instance = null;
}

export { schema };
