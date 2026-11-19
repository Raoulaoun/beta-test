// Goal: GET the goal card; POST { kind: "pillar", pillar, target } | { kind: "band", band }
// to change it ("Save goal"), or { accept: true } for "Set as my next goal".
import { accountGuard, noStore } from "../../../lib/server/accountRoute.ts";
import { acceptSuggested, changeGoal, goalView } from "../../../lib/server/goals.ts";
import { latestLevers } from "../../../lib/server/dashboard.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const g = await accountGuard(req, false);
  if (!g.ok) return g.error;
  return Response.json(await goalView(g.account.id, await latestLevers(g.account.id)), { headers: noStore });
}

export async function POST(req: Request): Promise<Response> {
  const g = await accountGuard(req, true);
  if (!g.ok) return g.error;
  const b = await req.json().catch(() => ({}));
  if (b.accept === true) {
    if (!(await acceptSuggested(g.account.id))) return Response.json({ error: "no_suggestion" }, { status: 409 });
  } else if (b.kind === "pillar" && typeof b.pillar === "string" && Number.isInteger(b.target)) {
    if (!(await changeGoal(g.account.id, { kind: "pillar", pillar: b.pillar, target: b.target }))) return Response.json({ error: "not_an_option" }, { status: 422 });
  } else if (b.kind === "band" && typeof b.band === "string") {
    if (!(await changeGoal(g.account.id, { kind: "band", band: b.band }))) return Response.json({ error: "not_an_option" }, { status: 422 });
  } else {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  return Response.json(await goalView(g.account.id, await latestLevers(g.account.id)), { headers: noStore });
}
