// Create an admin user. Prints a generated password and the authenticator setup link once.
// Usage (needs DATABASE_URL and ADMIN_TOTP_KEY): node dist/admin-create.cjs <email> "<name>"
import { randomBytes } from "node:crypto";
import { closeDb } from "../lib/db/index.ts";
import { createAdmin } from "../lib/server/adminAuth.ts";
import { newTotpSecret, otpauthUri } from "../lib/server/totp.ts";

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) throw new Error('usage: admin-create <email> "<name>"');
  const password = randomBytes(18).toString("base64url");
  const secret = newTotpSecret();
  await createAdmin(email, name, password, secret);
  console.log(`Admin created: ${email}`);
  console.log(`Password (shown once): ${password}`);
  console.log(`Authenticator setup key: ${secret}`);
  console.log(`Authenticator link: ${otpauthUri(secret, email)}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(closeDb);
