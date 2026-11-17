import { headers } from "next/headers";
import { sx } from "../../../lib/sx.ts";
import { adminFromCookie } from "../../../lib/server/adminAuth.ts";
import { BANDS, MANAGE_LABEL, STAGES, WEAKNESS_LABEL, bandLabel, campaigns, countLeads, listLeads, stageLabel } from "../../../lib/server/admin.ts";
import { parseFilters } from "../../../lib/server/adminFilters.ts";
import { LeadFilters } from "../../../components/admin/LeadFilters.tsx";
import { ScoreChip, WaIcon, fmtDate, h1, stageColors, th, theadRow, waLink } from "../../../components/admin/ui.tsx";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const filters = parseFilters(q);
  const admin = (await adminFromCookie((await headers()).get("cookie")))!;
  const [rows, total, camps] = await Promise.all([listLeads(filters), countLeads(), campaigns()]);
  const exportQs = new URLSearchParams(Object.entries(q).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  return (
    <>
      <div style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
        <div><h1 style={sx(h1)}>Leads</h1><p style={sx("margin:6px 0 0;font-size:14px;color:#6B7684")}>{rows.length} of {total} leads · newest first</p></div>
        <a href={`/api/admin/export${exportQs ? `?${exportQs}` : ""}`} data-testid="export-csv" style={sx("display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;border:1px solid #DDE2E7;background:#FFFFFF;color:#0B1F3A;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path></svg>Export CSV</a>
      </div>
      <LeadFilters bands={BANDS} campaigns={camps} stages={STAGES} />
      <div style={sx("border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;overflow:hidden")}>
        <table style={sx("width:100%;border-collapse:collapse;font-size:13.5px")}>
          <thead><tr style={sx(theadRow)}>
            <th style={sx("padding:12px 16px;font-weight:700")}>Name</th><th style={sx(th)}>Date</th><th style={sx(th)}>Score</th><th style={sx(th)}>Band</th><th style={sx(th)}>Manages</th><th style={sx(th)}>Top weakness</th><th style={sx(th)}>Source / campaign</th><th style={sx(th)}>Broker</th><th style={sx(th)}>Stage</th><th style={sx("padding:12px 16px;font-weight:700;text-align:right")}>WhatsApp</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const [sb, sf] = stageColors(r.stage ?? "new");
              const wa = waLink(r.phone, r.name, admin.name);
              return (
                <tr key={r.id} data-testid="lead-row" style={sx("border-top:1px solid #EEF0F2")}>
                  <td style={sx("padding:10px 16px")}><a href={`/admin/leads/${r.id}`} style={sx("display:inline-flex;align-items:center;min-height:36px;font-size:14px;font-weight:700;color:#0B1F3A")}>{r.name || r.email}</a></td>
                  <td style={sx("padding:10px;color:#4C5A6E;white-space:nowrap")}>{fmtDate(r.createdAt)}</td>
                  <td style={sx("padding:10px")}><ScoreChip score={r.score ?? null} /></td>
                  <td style={sx("padding:10px;white-space:nowrap")}>{r.scoreType === "starter" ? "Starter read" : bandLabel(r.band ?? null)}</td>
                  <td style={sx("padding:10px;white-space:nowrap;color:#4C5A6E")}>{MANAGE_LABEL[r.managing ?? ""] ?? "—"}</td>
                  <td style={sx("padding:10px")}>{r.topWeakness ? WEAKNESS_LABEL[r.topWeakness] ?? r.topWeakness : "—"}</td>
                  <td style={sx("padding:10px;color:#4C5A6E;white-space:nowrap")}>{r.campaign ?? "Organic"}</td>
                  <td style={sx("padding:10px;color:#4C5A6E;white-space:nowrap")}>{r.broker ?? "—"}</td>
                  <td style={sx("padding:10px")}><span style={{ ...sx("display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap"), background: sb, color: sf }}>{stageLabel(r.stage ?? "new")}</span></td>
                  <td style={sx("padding:10px 16px;text-align:right")}>{wa && <a href={wa} target="_blank" rel="noopener" aria-label={`WhatsApp ${r.name ?? ""}`} style={sx("display:inline-flex;align-items:center;justify-content:center;width:44px;height:36px;border-radius:999px;background:#0E6B4F;color:#FFFFFF")}><WaIcon /></a>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div style={sx("padding:40px;text-align:center;font-size:14px;color:#6B7684")}>No leads match these filters.</div>}
      </div>
    </>
  );
}
