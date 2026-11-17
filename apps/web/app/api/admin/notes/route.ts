import { addNote } from "../../../../lib/server/admin.ts";
import { adminGuard } from "../../../../lib/server/adminRoute.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const g = await adminGuard(req);
  if (!g.ok) return g.error;
  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!/^[0-9a-f-]{36}$/.test(body.account_id ?? "") || !text) return Response.json({ error: "invalid" }, { status: 400 });
  await addNote(body.account_id, g.admin.name, text);
  return Response.json({ ok: true });
}
