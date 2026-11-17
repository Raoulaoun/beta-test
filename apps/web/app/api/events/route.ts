// Anonymous funnel counts from the browser: landing visits and upload starts.
import { attributionFrom, deviceFrom } from "../../../lib/server/attribution.ts";
import { recordEvent } from "../../../lib/server/results.ts";

export const dynamic = "force-dynamic";
const KINDS = new Set(["visit", "upload_started"] as const);

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  if (!KINDS.has(body.kind)) return Response.json({ error: "bad_request" }, { status: 400 });
  const { campaign } = attributionFrom(new URLSearchParams(typeof body.attribution === "string" ? body.attribution : ""));
  await recordEvent(body.kind, { campaign, device: deviceFrom(req.headers.get("user-agent")) }).catch(() => undefined);
  return new Response(null, { status: 204 });
}
