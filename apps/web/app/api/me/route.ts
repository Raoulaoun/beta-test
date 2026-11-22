import { renewSession, sessionAccount } from "../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const cookie = req.headers.get("cookie");
  const account = await sessionAccount(cookie).catch(() => null);
  const headers = new Headers({ "cache-control": "no-store" });
  // A visit renews the year-long session (at most once a day).
  const renewed = account ? await renewSession(cookie).catch(() => null) : null;
  if (renewed) headers.set("set-cookie", renewed);
  return Response.json(account ? { signed_in: true, email: account.email, name: account.name } : { signed_in: false }, { headers });
}
