import { SETTING_KEYS, setLinks, validSetting } from "../../../../lib/server/settings.ts";
import { adminGuard } from "../../../../lib/server/adminRoute.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const g = await adminGuard(req);
  if (!g.ok) return g.error;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, string> = {};
  for (const k of SETTING_KEYS) {
    if (typeof body[k] !== "string") continue;
    const v = body[k].trim();
    if (!validSetting(k, v)) return Response.json({ error: "invalid_link", field: k }, { status: 422 });
    values[k] = v;
  }
  await setLinks(values, g.admin.email);
  return Response.json({ ok: true });
}
