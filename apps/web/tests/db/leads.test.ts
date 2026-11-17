import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { resetDb } from "./helpers.ts";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { saveResult, recordProgress } from "../../lib/server/results.ts";
import { submitLead, validateLead, type LeadInput } from "../../lib/server/leads.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";

beforeEach(resetDb);
after(closeDb);

const engine = () => ({ ...structuredClone(DESIGN_FIXTURES.results), account: { ...DESIGN_FIXTURES.results.account, platform: "MT5" as const } });
const ctx = { campaign: "ig-2347", utm: { utm_campaign: "ig-2347" }, introducedBy: "INTRO7", device: "Android" };
const lead = (r: { id: string; accessToken: string }, over: Partial<LeadInput> = {}): LeadInput => ({
  result_id: r.id, token: r.accessToken, name: "Karim Haddad", email: "Karim@Example.com", cc: "+961",
  phone: "3 123 456", manage: "Yes, friends and family", consent: true, updates: false, remind: true, ...over,
});
const count = async (t: typeof s.funnelEvents, kind: string) =>
  (await db().select({ n: sql<number>`count(*)::int` }).from(t).where(eq(s.funnelEvents.kind, kind as never)))[0].n;

test("server validation: real mobile number, consent, known option", () => {
  const base = lead({ id: "x", accessToken: "y" });
  assert.deepEqual(validateLead(base).errors, {});
  assert.equal(validateLead(base).phone, "+9613123456");
  assert.equal(validateLead(base).country, "LB");
  assert.ok(validateLead({ ...base, phone: "3 12" }).errors.phone);
  assert.ok(validateLead({ ...base, cc: "+44", phone: "20 7946 0000" }).errors.phone, "a UK landline is not a mobile");
  assert.ok(!validateLead({ ...base, cc: "+44", phone: "7911 123456" }).errors.phone);
  assert.equal(validateLead({ ...base, cc: "+44", phone: "7911 123456" }).country, "GB");
  assert.ok(validateLead({ ...base, consent: false }).errors.consent);
  assert.ok(validateLead({ ...base, manage: "Maybe" }).errors.manage);
  assert.ok(validateLead({ ...base, email: "karim@" }).errors.email);
});

test("a new email creates the account, its CRM row, and attaches the result", async () => {
  const r = await saveResult(engine(), ctx);
  const out = await submitLead(lead(r), null);
  assert.equal(out.kind, "ok");
  const [a] = await db().select().from(s.accounts);
  assert.equal(a.email, "karim@example.com");
  assert.equal(a.phone, "+9613123456");
  assert.equal(a.managingForOthers, "friends_family");
  assert.equal(a.introducedBy, "INTRO7");
  assert.ok(a.retestReminderAt && a.retestReminderAt.getTime() > Date.now() + 59 * 86_400_000);
  const [c] = await db().select().from(s.crm);
  assert.equal(c.stage, "new");
  const [res] = await db().select().from(s.results);
  assert.equal(res.accountId, a.id);
  assert.ok(res.convertedAt);
  assert.equal(await count(s.funnelEvents, "lead_submitted"), 1);
});

test("an existing email from someone not signed in: result held as pending, profile untouched", async () => {
  const first = await saveResult(engine(), ctx);
  await submitLead(lead(first), null);
  const second = await saveResult(engine(), ctx);
  const out = await submitLead(lead(second, { name: "Someone Else", phone: "3 999 999" }), null);
  assert.equal(out.kind, "ok");
  const [a] = await db().select().from(s.accounts);
  assert.equal(a.name, "Karim Haddad");
  assert.equal(a.phone, "+9613123456");
  const [res] = await db().select().from(s.results).where(eq(s.results.id, second.id));
  assert.equal(res.accountId, null);
  assert.equal(res.pendingAccountId, a.id);
});

test("signed in as the account: the result attaches and the profile updates", async () => {
  const first = await saveResult(engine(), ctx);
  const created = await submitLead(lead(first), null);
  assert.equal(created.kind, "ok");
  const id = created.kind === "ok" ? created.accountId : "";
  const second = await saveResult(engine(), ctx);
  await submitLead(lead(second, { phone: "71 234 567" }), id);
  const [res] = await db().select().from(s.results).where(eq(s.results.id, second.id));
  assert.equal(res.accountId, id);
  const [a] = await db().select().from(s.accounts);
  assert.equal(a.phone, "+96171234567");
});

test("wrong token or invalid fields change nothing", async () => {
  const r = await saveResult(engine(), ctx);
  assert.equal((await submitLead(lead(r, { token: "nope" }), null)).kind, "no_result");
  assert.equal((await submitLead(lead(r, { consent: false }), null)).kind, "invalid");
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(s.accounts);
  assert.equal(n, 0);
});

test("a lead after the exit prompt counts as recovered, once", async () => {
  const r = await saveResult(engine(), ctx);
  await recordProgress(r.id, r.accessToken, "exit_prompt");
  await submitLead(lead(r), null);
  await submitLead(lead(r), null); // resubmitting doesn't double count
  assert.equal(await count(s.funnelEvents, "exit_prompt_converted"), 1);
  assert.equal(await count(s.funnelEvents, "lead_submitted"), 1);
});
