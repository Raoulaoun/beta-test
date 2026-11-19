// Settings: your details and email preferences. Deleting the account is DELETE /api/account.
import { accountGuard, noStore } from "../../../lib/server/accountRoute.ts";
import { getSettings, updateSettings, type SettingsInput } from "../../../lib/server/accountSettings.ts";

export const dynamic = "force-dynamic";
const BOOLS = ["retest_reminders", "updates", "monthly_checkup"] as const;
const TEXTS = ["name", "cc", "phone"] as const;

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
  const v: SettingsInput = {};
  for (const k of BOOLS) if (k in body) { if (typeof body[k] !== "boolean") return Response.json({ error: "bad_request" }, { status: 400 }); v[k] = body[k]; }
  for (const k of TEXTS) if (k in body) { if (typeof body[k] !== "string") return Response.json({ error: "bad_request" }, { status: 400 }); v[k] = body[k]; }
  if (!Object.keys(v).length) return Response.json({ error: "bad_request" }, { status: 400 });
  const out = await updateSettings(g.account.id, v);
  if (!out) return Response.json({ error: "not_found" }, { status: 404 });
  if (!out.ok) return Response.json({ error: "invalid", fields: out.fields }, { status: 422 });
  return Response.json(out.settings, { headers: noStore });
}
