// Delete my account: the account, its results and insights, goals, CRM data and sessions.
import { deleteAccount } from "../../../lib/server/auth.ts";
import { sessionAccount, sessionCookie } from "../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request): Promise<Response> {
  const account = await sessionAccount(req.headers.get("cookie")).catch(() => null);
  if (!account) return Response.json({ error: "not_signed_in" }, { status: 401 });
  await deleteAccount(account.id);
  return new Response(null, { status: 204, headers: { "set-cookie": sessionCookie("", 0) } });
}
