// "Send me a sign-in link" from the signed-out banner (known device, not signed in).
import { requestKnownSignIn } from "../../../../lib/server/auth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.result_id === "string" ? body.result_id : "";
  const token = typeof body.token === "string" ? body.token : "";
  try {
    const out = await requestKnownSignIn(req.headers.get("cookie"), id, token);
    if (out === "unknown") return Response.json({ error: "unknown_device" }, { status: 404 });
    if (out === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
