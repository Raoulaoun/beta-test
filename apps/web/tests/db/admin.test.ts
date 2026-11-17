import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { base32Encode, currentStep, totpAt, verifyTotp } from "../../lib/server/totp.ts";
import { ADMIN_COOKIE, adminCodeStep, adminFromCookie, adminPasswordStep, checkPassword, createAdmin, decryptSecret, encryptSecret, hashPassword } from "../../lib/server/adminAuth.ts";
import { csvCell } from "../../lib/server/adminFilters.ts";

process.env.ADMIN_TOTP_KEY ||= "0".repeat(64);
beforeEach(resetDb);
after(closeDb);

test("TOTP matches the RFC 6238 SHA-1 test vector", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(totpAt(secret, Math.floor(59 / 30)), "287082");          // RFC: 94287082
  assert.equal(totpAt(secret, Math.floor(1111111109 / 30)), "081804");  // RFC: 07081804
  assert.equal(verifyTotp(secret, "287082", 59_000), 1);
  assert.equal(verifyTotp(secret, "000000", 59_000), null);
});

test("passwords are scrypt-hashed; TOTP secrets are encrypted", () => {
  const h = hashPassword("correct horse");
  assert.ok(h.startsWith("scrypt$") && !h.includes("correct horse"));
  assert.ok(checkPassword("correct horse", h));
  assert.ok(!checkPassword("wrong", h));
  const enc = encryptSecret("JBSWY3DPEHPK3PXP");
  assert.ok(!enc.includes("JBSWY3DP"));
  assert.equal(decryptSecret(enc), "JBSWY3DPEHPK3PXP");
});

test("password then code gives a session; a code can't be replayed", async () => {
  const secret = base32Encode(Buffer.from("admin-secret-123456"));
  await createAdmin("raoul@example.com", "Raoul", "pw-long-enough", secret);
  const p1 = await adminPasswordStep("Raoul@Example.com", "pw-long-enough");
  assert.ok(typeof p1 === "object");
  assert.equal(await adminFromCookie(`${ADMIN_COOKIE}=${typeof p1 === "object" ? p1.pending : ""}`), null, "a pending token is not a session");
  const code = totpAt(secret, currentStep());
  const ok = await adminCodeStep(typeof p1 === "object" ? p1.pending : "", code);
  assert.ok(typeof ok === "object");
  const me = await adminFromCookie(`${ADMIN_COOKIE}=${typeof ok === "object" ? ok.session : ""}`);
  assert.equal(me?.email, "raoul@example.com");

  const p2 = await adminPasswordStep("raoul@example.com", "pw-long-enough");
  assert.equal(await adminCodeStep(typeof p2 === "object" ? p2.pending : "", code), "invalid", "same code twice is refused");
});

test("5 failures in 15 minutes lock sign-in", async () => {
  await createAdmin("raoul@example.com", "Raoul", "pw-long-enough", base32Encode(Buffer.from("x".repeat(20))));
  for (let i = 0; i < 5; i++) assert.equal(await adminPasswordStep("raoul@example.com", "wrong"), "invalid");
  assert.equal(await adminPasswordStep("raoul@example.com", "pw-long-enough"), "locked");
  await db().update(s.adminLoginAttempts).set({ createdAt: new Date(Date.now() - 16 * 60_000) });
  assert.ok(typeof (await adminPasswordStep("raoul@example.com", "pw-long-enough")) === "object");
});

test("unknown admin emails fail the same way", async () => {
  assert.equal(await adminPasswordStep("nobody@example.com", "x"), "invalid");
});

test("CSV cells can't start a spreadsheet formula", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+961 3 123"), `"'+961 3 123"`);
  assert.equal(csvCell("Karim"), `"Karim"`);
  assert.equal(csvCell(null), `""`);
});
