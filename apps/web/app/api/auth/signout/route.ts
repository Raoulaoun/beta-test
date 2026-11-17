import { endSession, sessionCookie } from "../../../../lib/server/session.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  await endSession(req.headers.get("cookie")).catch(() => undefined);
  return new Response(null, { status: 204, headers: { "set-cookie": sessionCookie("", 0) } });
}
