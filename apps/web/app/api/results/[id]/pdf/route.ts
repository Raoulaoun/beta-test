// "Download report" / "PDF" on the dashboard: the owner's report, rendered on request.
import { eq } from "drizzle-orm";
import { db, schema as s } from "../../../../../lib/db/index.ts";
import { sessionAccount } from "../../../../../lib/server/session.ts";
import { pdfFilename, renderPdf, reportInput } from "../../../../../lib/server/report.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const account = await sessionAccount(req.headers.get("cookie")).catch(() => null);
  if (!account) return Response.redirect(new URL("/signin", req.url), 303);
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await db().select({ accountId: s.results.accountId }).from(s.results).where(eq(s.results.id, id));
  if (!row || row.accountId !== account.id) return Response.json({ error: "not_found" }, { status: 404 });
  const input = await reportInput(id);
  if (!input) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const pdf = await renderPdf(input.pdf);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${pdfFilename(input.name)}"`, "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "report_unavailable" }, { status: 503 });
  }
}
