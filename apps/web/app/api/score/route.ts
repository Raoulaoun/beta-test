// Upload: browser → this route → scoring service, then the result is saved.
// The statement is held in memory only, passed on as the raw body, and dropped. Only the
// result is saved (no statement, no account number). Nothing about the body is logged.
import { attributionFrom, deviceFrom } from "../../../lib/server/attribution.ts";
import { knownAccount } from "../../../lib/server/known.ts";
import { freeCoach, recordEvent, saveResult } from "../../../lib/server/results.ts";
import { sessionAccount } from "../../../lib/server/session.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const SCORING_URL = process.env.SCORING_URL || "http://127.0.0.1:8000";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function readBody(req: Request): Promise<Buffer | "too_large" | "empty"> {
  if (Number(req.headers.get("content-length") || "0") > MAX_BYTES) return "too_large";
  if (!req.body) return "empty";
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
      return "too_large";
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  chunks.length = 0;
  return body;
}

export async function POST(req: Request): Promise<Response> {
  const body = await readBody(req);
  if (body === "too_large") return json({ error: "file_too_large" }, 413);
  if (body === "empty") return json({ error: "empty_report" }, 422);

  let scored: Response;
  try {
    scored = await fetch(`${SCORING_URL}/score`, {
      method: "POST", body: new Uint8Array(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength), headers: { "content-type": "application/octet-stream" },
      cache: "no-store", signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return json({ error: "scoring_unavailable" }, 502);
  } finally {
    body.fill(0);
  }
  const result = await scored.json().catch(() => null);
  if (!scored.ok || !result) return json(result ?? { error: "scoring_unavailable" }, scored.ok ? 502 : scored.status);

  try {
    const url = new URL(req.url);
    const attribution = attributionFrom(url.searchParams);
    const device = deviceFrom(req.headers.get("user-agent"));
    const account = await sessionAccount(req.headers.get("cookie"));
    const saved = await saveResult(result, { ...attribution, device, accountId: account?.id ?? null });
    await recordEvent("score_shown", { campaign: attribution.campaign, resultId: saved.id, device });
    const { account_masked: _m, fingerprint: _f, ...acct } = result.account;
    const known = !account && !!(await knownAccount(req.headers.get("cookie")).catch(() => null));
    return json({ ...result, account: acct, coach: freeCoach(result), result_id: saved.id, access_token: saved.accessToken,
      saved_to_account: !!account, known_account: known });
  } catch {
    // The score exists but couldn't be saved: the lead form would have nothing to attach to.
    return json({ error: "storage_unavailable" }, 503);
  }
}
