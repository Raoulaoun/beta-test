// Step 2: the code. Right code → signed in (session and known-device cookies).
import { verifySignInCode } from "../../../../../lib/server/auth.ts";
import { SESSION_DAYS, sessionCookie } from "../../../../../lib/server/session.ts";
import { knownCookie, rememberDevice } from "../../../../../lib/server/known.ts";
import { sameOrigin } from "../../../../../lib/server/adminAuth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.email !== "string" || typeof body.code !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  // Optional: the result on screen (signed-out banner), added to the history on success.
  const attach = typeof body.result_id === "string" && typeof body.token === "string" ? { id: body.result_id, token: body.token } : undefined;
  const out = await verifySignInCode(body.email, body.code, attach).catch(() => null);
  if (!out) return Response.json({ error: "server_error" }, { status: 500 });
  if (!out.ok) return Response.json(out.reason === "wrong" ? { error: "wrong", tries_left: out.triesLeft } : { error: out.reason }, { status: 401 });
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", sessionCookie(out.sessionToken, SESSION_DAYS * 86_400));
  headers.append("set-cookie", knownCookie(await rememberDevice(out.accountId)));
  return Response.json({ ok: true }, { headers });
}
