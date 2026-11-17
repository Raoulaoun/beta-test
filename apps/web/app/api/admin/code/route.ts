import { ADMIN_SESSION_HOURS, adminCodeStep, adminCookie, sameOrigin } from "../../../../lib/server/adminAuth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.pending !== "string" || typeof body.code !== "string") return Response.json({ error: "invalid" }, { status: 400 });
  const out = await adminCodeStep(body.pending, body.code);
  if (out === "locked") return Response.json({ error: "locked" }, { status: 429 });
  if (out === "invalid") return Response.json({ error: "invalid" }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "set-cookie": adminCookie(out.session, ADMIN_SESSION_HOURS * 3600), "cache-control": "no-store" } });
}
