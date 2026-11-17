// CSV of the filtered leads list, for moving leads into Beta's main CRM.
import { adminFromCookie } from "../../../../lib/server/adminAuth.ts";
import { MANAGE_LABEL, WEAKNESS_LABEL, bandLabel, listLeads, stageLabel } from "../../../../lib/server/admin.ts";
import { csvCell, parseFilters } from "../../../../lib/server/adminFilters.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  if (!(await adminFromCookie(req.headers.get("cookie")))) return new Response(null, { status: 401 });
  const rows = await listLeads(parseFilters(new URL(req.url).searchParams));
  const header = ["Name", "Email", "Phone", "Date", "Score", "Score type", "Band", "Manages for others", "Top weakness", "Campaign", "Broker", "Stage"];
  const lines = [header, ...rows.map((r) => [r.name, r.email, r.phone, r.createdAt.toISOString().slice(0, 10), r.score, r.scoreType,
    r.scoreType === "starter" ? "Starter read" : bandLabel(r.band ?? null), MANAGE_LABEL[r.managing ?? ""] ?? "",
    r.topWeakness ? WEAKNESS_LABEL[r.topWeakness] ?? r.topWeakness : "", r.campaign ?? "Organic", r.broker ?? "", stageLabel(r.stage ?? "new")])];
  const csv = lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
  return new Response("﻿" + csv, { headers: {
    "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="manager-test-leads.csv"', "cache-control": "no-store",
  } });
}
