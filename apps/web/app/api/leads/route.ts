import { submitLead, type LeadInput } from "../../../lib/server/leads.ts";
import { createSession, SESSION_DAYS, sessionAccount, sessionCookie } from "../../../lib/server/session.ts";
import { verifyTurnstile } from "../../../lib/server/turnstile.ts";
import { knownCookie, rememberDevice } from "../../../lib/server/known.ts";
import { newToken } from "../../../lib/server/crypto.ts";
import { sendReport } from "../../../lib/server/report.ts";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as (LeadInput & { turnstile?: string }) | null;
  if (!body || typeof body !== "object") return json({ error: "bad_request" }, 400);
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const check = await verifyTurnstile(body.turnstile, ip);
  if (check === "misconfigured") return json({ error: "server_error" }, 503);
  if (check === "failed") return json({ error: "verification_failed" }, 403);
  try {
    const account = await sessionAccount(req.headers.get("cookie"));
    const out = await submitLead(body, account?.id ?? null);
    if (out.kind === "invalid") return json({ error: "invalid", fields: Object.keys(out.errors) }, 422);
    if (out.kind === "no_result") return json({ error: "no_result" }, 404);
    // Same answer whether the email was new or not: never reveal who has an account. The
    // known-device cookie is set either way; for an existing email sent by someone not signed
    // in as it, it is a token that matches nothing.
    // The report goes to the email given, with the PDF attached (after the response).
    void sendReport(body.result_id, out.email, out.accountId);
    const token = out.pending ? newToken() : await rememberDevice(out.accountId);
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", knownCookie(token));
    // Signed in on this browser straight away (no email, no code), unless someone is already
    // signed in here. For an email that already has an account, typed by someone not signed in
    // as it, the session cookie is one that matches nothing: same response, no access.
    if (!account) {
      const session = out.pending ? newToken() : await createSession(out.accountId);
      headers.append("set-cookie", sessionCookie(session, SESSION_DAYS * 86_400));
    }
    return Response.json({ ok: true, sent_to: out.email }, { headers });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
