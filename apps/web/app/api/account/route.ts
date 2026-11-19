// Delete my account: the account, its results and insights, goals, CRM data, sessions and known devices.
import { deleteAccountWithConfirmation } from "../../../lib/server/auth.ts";
import { sessionAccount, sessionCookie } from "../../../lib/server/session.ts";
import { sameOrigin } from "../../../lib/server/adminAuth.ts";
import { KNOWN_COOKIE } from "../../../lib/server/known.ts";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const account = await sessionAccount(req.headers.get("cookie")).catch(() => null);
  if (!account) return Response.json({ error: "not_signed_in" }, { status: 401 });
  await deleteAccountWithConfirmation(account.id); // known devices, goals, results and insights go with it (cascade)
  const headers = new Headers();
  headers.append("set-cookie", sessionCookie("", 0));
  headers.append("set-cookie", `${KNOWN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 204, headers });
}
