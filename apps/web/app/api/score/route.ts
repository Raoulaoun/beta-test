// Upload proxy: browser → this route → scoring service.
// The statement is held in memory only, passed on as the raw body, and dropped.
// Nothing about the request body is ever logged.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const SCORING_URL = process.env.SCORING_URL || "http://127.0.0.1:8000";

export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get("content-length") || "0");
  if (declared > MAX_BYTES) return Response.json({ error: "file_too_large" }, { status: 413 });
  if (!req.body) return Response.json({ error: "empty_report" }, { status: 422 });

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      chunks.length = 0;
      return Response.json({ error: "file_too_large" }, { status: 413 });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  chunks.length = 0;

  try {
    const res = await fetch(`${SCORING_URL}/score`, {
      method: "POST",
      body,
      headers: { "content-type": "application/octet-stream" },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    const json = await res.json();
    return Response.json(json, { status: res.status, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "scoring_unavailable" }, { status: 502 });
  } finally {
    body.fill(0);
  }
}
