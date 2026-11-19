// Guard for a signed-in trader's own data; changes also need a same-origin request.
import { sameOrigin } from "./adminAuth.ts";
import { sessionAccount } from "./session.ts";

export async function accountGuard(req: Request, mutation: boolean) {
  if (mutation && !sameOrigin(req)) return { ok: false as const, error: Response.json({ error: "forbidden" }, { status: 403 }) };
  const account = await sessionAccount(req.headers.get("cookie")).catch(() => null);
  if (!account) return { ok: false as const, error: Response.json({ error: "not_signed_in" }, { status: 401 }) };
  return { ok: true as const, account };
}

export const noStore = { "cache-control": "no-store" };
