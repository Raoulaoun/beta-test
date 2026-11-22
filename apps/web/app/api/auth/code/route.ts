// Step 1 of signing in with a code: email the 6-digit code. Same answer whether or not the
// email has an account.
import { requestSignInCode } from "../../../../lib/server/auth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || email.length > 254) return Response.json({ error: "invalid_email" }, { status: 422 });
  try {
    const out = await requestSignInCode(email);
    return out === "rate_limited" ? Response.json({ error: "rate_limited" }, { status: 429 }) : Response.json({ ok: true });
  } catch {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
