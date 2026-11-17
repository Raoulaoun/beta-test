import { sessionAccount } from "../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const account = await sessionAccount(req.headers.get("cookie")).catch(() => null);
  return Response.json(account ? { signed_in: true, email: account.email, name: account.name } : { signed_in: false },
    { headers: { "cache-control": "no-store" } });
}
