// Daily job: delete anonymous results older than 90 days that never became a lead.
// Bundled to dist/retention.cjs; scheduled with the other jobs (Phase 9).
import { closeDb } from "../lib/db/index.ts";
import { deleteStaleDropoffs } from "../lib/server/results.ts";

deleteStaleDropoffs()
  .then((n) => console.log(`deleted ${n} anonymous results older than 90 days`))
  .catch((err) => { console.error("retention failed:", err instanceof Error ? err.message : err); process.exitCode = 1; })
  .finally(closeDb);
