// Sign out: ends the session and forgets this browser (no known-device cookie left), so
// nothing about the account stays on it.
import { endSession, sessionCookie } from "../../../../lib/server/session.ts";
import { clearKnownCookie, forgetDevice } from "../../../../lib/server/known.ts";
import { sameOrigin } from "../../../../lib/server/adminAuth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const cookie = req.headers.get("cookie");
  await endSession(cookie).catch(() => undefined);
  await forgetDevice(cookie).catch(() => undefined);
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", sessionCookie("", 0));
  headers.append("set-cookie", clearKnownCookie);
  return new Response(null, { status: 204, headers });
}
