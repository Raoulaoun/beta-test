// Guard for admin mutations: signed-in admin + same-origin request.
import { adminFromCookie, sameOrigin } from "./adminAuth.ts";

type Admin = { id: string; email: string; name: string };
export type Guard = { ok: false; error: Response } | { ok: true; admin: Admin };

export async function adminGuard(req: Request): Promise<Guard> {
  if (!sameOrigin(req)) return { ok: false, error: Response.json({ error: "forbidden" }, { status: 403 }) };
  const admin = await adminFromCookie(req.headers.get("cookie")).catch(() => null);
  if (!admin) return { ok: false, error: Response.json({ error: "not_signed_in" }, { status: 401 }) };
  return { ok: true, admin };
}
