// The uploading browser reopens its saved result (30 days, until a lead is sent).
import { reopenResult } from "../../../../lib/server/results.ts";
import { knownAccount } from "../../../../lib/server/known.ts";
import { sessionAccount } from "../../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") || "";
  const found = await reopenResult(id, token).catch(() => null);
  if (!found) return Response.json({ error: "not_found" }, { status: 404 });
  const cookie = req.headers.get("cookie");
  const known = !(await sessionAccount(cookie).catch(() => null)) && !!(await knownAccount(cookie).catch(() => null));
  return Response.json({ ...found.payload, result_id: id, converted: found.converted, known_account: known }, { headers: { "cache-control": "no-store" } });
}
