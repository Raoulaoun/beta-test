// Settings: email choices. Deleting the account is DELETE /api/account.
import { accountGuard, noStore } from "../../../lib/server/accountRoute.ts";
import { getSettings, updateSettings } from "../../../lib/server/accountSettings.ts";

export const dynamic = "force-dynamic";
const KEYS = ["retest_reminders", "updates", "monthly_checkup"] as const;

export async function GET(req: Request): Promise<Response> {
  const g = await accountGuard(req, false);
  if (!g.ok) return g.error;
  return Response.json(await getSettings(g.account.id), { headers: noStore });
}

export async function PATCH(req: Request): Promise<Response> {
  const g = await accountGuard(req, true);
  if (!g.ok) return g.error;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "bad_request" }, { status: 400 });
  const v: Record<string, boolean> = {};
  for (const k of KEYS) {
    if (k in body) {
      if (typeof body[k] !== "boolean") return Response.json({ error: "bad_request" }, { status: 400 });
      v[k] = body[k];
    }
  }
  if (!Object.keys(v).length) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await updateSettings(g.account.id, v), { headers: noStore });
}
