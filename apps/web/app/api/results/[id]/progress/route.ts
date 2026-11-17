// How far a visitor got on the results screen (for drop-off "left at").
import { recordProgress, type LeftAt } from "../../../../../lib/server/results.ts";

export const dynamic = "force-dynamic";
const STEPS = new Set<LeftAt>(["score", "pillars", "lead_form", "exit_prompt"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!STEPS.has(body.step) || typeof body.token !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  const ok = await recordProgress(id, body.token, body.step).catch(() => false);
  return Response.json({ ok }, { status: ok ? 200 : 404 });
}
