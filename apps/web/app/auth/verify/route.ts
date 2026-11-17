// Sign-in link target. GET only shows a page that confirms with a POST, because email
// security scanners open links (GET) and would otherwise use up the single-use token.
import { verifySignIn } from "../../../lib/server/auth.ts";
import { SESSION_DAYS, sessionCookie } from "../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

const page = (token: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>The Manager Test, by Beta</title></head><body style="margin:0;background:#FAFAF8">
<form id="f" method="post" action="/auth/verify"><input type="hidden" name="token" value="${token.replace(/[^\w-]/g, "")}">
<noscript><button type="submit" style="margin:40px;height:52px;padding:0 28px;border:none;border-radius:999px;background:#0E6B4F;color:#fff;font:700 13px system-ui;letter-spacing:.06em;text-transform:uppercase">Continue</button></noscript></form>
<script>document.getElementById("f").submit()</script></body></html>`;

export function GET(req: Request): Response {
  const token = new URL(req.url).searchParams.get("token") || "";
  return new Response(page(token), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") || "");
  const out = await verifySignIn(token).catch(() => ({ ok: false as const }));
  const headers = new Headers({ "cache-control": "no-store" });
  if (!out.ok) {
    headers.set("location", "/?signin=expired");
    return new Response(null, { status: 303, headers });
  }
  headers.set("set-cookie", sessionCookie(out.sessionToken, SESSION_DAYS * 86_400));
  headers.set("location", "/?signedin=1");
  return new Response(null, { status: 303, headers });
}
