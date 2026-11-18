// Funnel counts from the browser: landing visits, upload starts and lead-form opens.
import { attributionFrom, deviceFrom } from "../../../lib/server/attribution.ts";
import { FORM_SOURCES, recordEvent, recordFormOpened, type FormSource } from "../../../lib/server/results.ts";

export const dynamic = "force-dynamic";
const KINDS = new Set(["visit", "upload_started"] as const);
const SOURCES = new Set<string>(FORM_SOURCES);

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  if (body.kind === "form_opened") {
    if (!SOURCES.has(body.source) || typeof body.result_id !== "string" || typeof body.token !== "string") {
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    const ok = await recordFormOpened(body.result_id, body.token, body.source as FormSource).catch(() => false);
    return new Response(null, { status: ok ? 204 : 404 });
  }
  if (!KINDS.has(body.kind)) return Response.json({ error: "bad_request" }, { status: 400 });
  const { campaign } = attributionFrom(new URLSearchParams(typeof body.attribution === "string" ? body.attribution : ""));
  await recordEvent(body.kind, { campaign, device: deviceFrom(req.headers.get("user-agent")) }).catch(() => undefined);
  return new Response(null, { status: 204 });
}
