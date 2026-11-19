import { submitLead, type LeadInput } from "../../../lib/server/leads.ts";
import { sessionAccount } from "../../../lib/server/session.ts";
import { verifyTurnstile } from "../../../lib/server/turnstile.ts";
import { knownCookie, rememberDevice } from "../../../lib/server/known.ts";
import { newToken } from "../../../lib/server/crypto.ts";

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
    const token = out.pending ? newToken() : await rememberDevice(out.accountId);
    return Response.json({ ok: true, sent_to: out.email }, { headers: { "cache-control": "no-store", "set-cookie": knownCookie(token) } });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
