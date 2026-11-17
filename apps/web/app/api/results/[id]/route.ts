// The uploading browser reopens its saved result (30 days, until a lead is sent).
import { reopenResult } from "../../../../lib/server/results.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token") || "";
  const found = await reopenResult(id, token).catch(() => null);
  if (!found) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ...found.payload, result_id: id, converted: found.converted }, { headers: { "cache-control": "no-store" } });
}
