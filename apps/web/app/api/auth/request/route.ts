import { requestSignIn } from "../../../../lib/server/auth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.length > 254) {
    return Response.json({ error: "invalid_email" }, { status: 422 });
  }
  try {
    const out = await requestSignIn(email);
    if (out === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
