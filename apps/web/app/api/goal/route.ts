// Goal: GET the active goal and the "Change goal" options; POST { kind } to change it.
import { accountGuard, noStore } from "../../../lib/server/accountRoute.ts";
import { changeGoal, goalOptions, goalView } from "../../../lib/server/goals.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const g = await accountGuard(req, false);
  if (!g.ok) return g.error;
  return Response.json({ ...(await goalView(g.account.id)), options: await goalOptions(g.account.id) }, { headers: noStore });
}

export async function POST(req: Request): Promise<Response> {
  const g = await accountGuard(req, true);
  if (!g.ok) return g.error;
  const body = await req.json().catch(() => ({}));
  if (body.kind !== "pillar" && body.kind !== "band") return Response.json({ error: "bad_request" }, { status: 400 });
  const goal = await changeGoal(g.account.id, body.kind);
  if (!goal) return Response.json({ error: "no_option" }, { status: 409 });
  return Response.json(await goalView(g.account.id), { headers: noStore });
}
