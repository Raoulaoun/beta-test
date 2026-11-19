// Dashboard data: history per trading account, since your last result, coach findings, goal.
import { accountGuard, noStore } from "../../../lib/server/accountRoute.ts";
import { dashboard } from "../../../lib/server/dashboard.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const g = await accountGuard(req, false);
  if (!g.ok) return g.error;
  const data = await dashboard(g.account.id);
  return Response.json({ account: { email: g.account.email, name: g.account.name }, ...data }, { headers: noStore });
}
