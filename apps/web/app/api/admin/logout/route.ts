import { adminCookie, adminSignOut } from "../../../../lib/server/adminAuth.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  await adminSignOut(req.headers.get("cookie")).catch(() => undefined);
  return new Response(null, { status: 204, headers: { "set-cookie": adminCookie("", 0) } });
}
