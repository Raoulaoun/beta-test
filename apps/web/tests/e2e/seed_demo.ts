// Local demo data for admin screenshots, through the real server functions.
// Usage: DATABASE_URL=… node --experimental-strip-types tests/e2e/seed_demo.ts
import { eq } from "drizzle-orm";
import { closeDb, db, schema as s } from "../../lib/db/index.ts";
import { saveResult, recordEvent, recordProgress } from "../../lib/server/results.ts";
import { submitLead } from "../../lib/server/leads.ts";
import { setStage, addNote } from "../../lib/server/admin.ts";
import { DESIGN_FIXTURES } from "../../lib/fixtures.ts";

const people = [
  ["Karim Haddad", 67, "IG · 23:47 message", "new", "revenge_sizing", "IC Markets"], ["Lara Mansour", 82, "Webinar page", "webinar_registered", "stop_usage", "Exness"],
  ["Omar Khalil", 54, "IG · Five questions", "contacted", "max_drawdown", "XM"], ["Nadine Saab", 71, "Organic", "webinar_attended", "months_history", "Pepperstone"],
  ["Rami Fakhoury", 38, "IG · Handshake reel", "not_a_fit", "avg_loss", "FxPro"], ["Ziad Nassar", 88, "Webinar page", "applied", "revenge_sizing", "Exness"],
] as const;
const engine = (score: number, weak: string, broker: string) => {
  const r = structuredClone(DESIGN_FIXTURES.results) as typeof DESIGN_FIXTURES.results & { top_fixes: { metric: string }[] };
  const band = score >= 80 ? ["professional_grade", "Professional Grade"] : score >= 60 ? ["emerging_manager", "Emerging Manager"] : score >= 40 ? ["building", "Building"] : ["developing", "Developing"];
  return { ...r, score, band: { code: band[0], name: band[1], meaning: "" }, top_fixes: [{ metric: weak }], account: { ...r.account, broker, platform: "MT5" as const } };
};

async function main() {
  for (const [i, [name, score, camp, stage, weak, broker]] of people.entries()) {
    for (let v = 0; v < 6 + i; v++) await recordEvent("visit", { campaign: camp });
    await recordEvent("upload_started", { campaign: camp });
    const r = await saveResult(engine(score, weak, broker), { campaign: camp, utm: { utm_campaign: camp }, introducedBy: null, device: "iPhone" });
    await recordEvent("score_shown", { campaign: camp, resultId: r.id });
    const out = await submitLead({ result_id: r.id, token: r.accessToken, name, email: name.toLowerCase().replace(" ", ".") + "@example.com",
      cc: "+961", phone: `3 ${100 + i * 37} ${200 + i * 13}`, manage: ["No", "Yes, friends and family", "Yes, formally"][i % 3], consent: true, updates: false, remind: true }, null);
    if (out.kind === "ok") {
      await setStage(out.accountId, stage);
      if (i === 0) await addNote(out.accountId, "Raoul", "Manages for 4 friends. Interested in the webinar, asked about fees.");
    }
  }
  const drops = [[72, "max_drawdown", "IG · 23:47 message", "lead_form"], [64, "revenge_sizing", "IG · Handshake reel", "exit_prompt"], [45, "stop_usage", "Organic", "pillars"], [37, "max_drawdown", "IG · Handshake reel", "score"]] as const;
  for (const [score, weak, camp, left] of drops) {
    await recordEvent("visit", { campaign: camp }); await recordEvent("upload_started", { campaign: camp });
    const r = await saveResult(engine(score, weak, "XM"), { campaign: camp, utm: {}, introducedBy: null, device: left === "pillars" ? "Desktop" : "Android" });
    await recordEvent("score_shown", { campaign: camp, resultId: r.id });
    if (left !== "score") await recordProgress(r.id, r.accessToken, left);
  }
  const [{ id }] = await db().select({ id: s.accounts.id }).from(s.accounts).where(eq(s.accounts.email, "karim.haddad@example.com"));
  console.log("seeded; Karim =", id);
}
main().finally(closeDb);
