import { adminPasswordStep, sameOrigin } from "../../../../lib/server/adminAuth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.email !== "string" || typeof body.password !== "string") return Response.json({ error: "invalid" }, { status: 400 });
  const out = await adminPasswordStep(body.email, body.password);
  if (out === "locked") return Response.json({ error: "locked" }, { status: 429 });
  if (out === "invalid") return Response.json({ error: "invalid" }, { status: 401 });
  return Response.json({ pending: out.pending }, { headers: { "cache-control": "no-store" } });
}
