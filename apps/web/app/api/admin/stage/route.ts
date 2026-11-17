import { STAGES, setStage, type StageCode } from "../../../../lib/server/admin.ts";
import { adminGuard } from "../../../../lib/server/adminRoute.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const g = await adminGuard(req);
  if (!g.ok) return g.error;
  const body = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/.test(body.account_id ?? "") || !STAGES.some(([k]) => k === body.stage)) return Response.json({ error: "invalid" }, { status: 400 });
  await setStage(body.account_id, body.stage as StageCode);
  return Response.json({ ok: true });
}
