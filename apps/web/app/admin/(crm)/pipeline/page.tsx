import { sx } from "../../../../lib/sx.ts";
import { STAGES, listLeads } from "../../../../lib/server/admin.ts";
import { StageSelect } from "../../../../components/admin/LeadActions.tsx";
import { ScoreChip, h1 } from "../../../../components/admin/ui.tsx";

export default async function PipelinePage() {
  const leads = await listLeads();
  return (
    <>
      <h1 style={sx(h1)}>Pipeline</h1>
      <div style={sx("display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:start")}>
        {STAGES.map(([code, name]) => {
          const cards = leads.filter((l) => (l.stage ?? "new") === code);
          return (
            <div key={code} data-testid={`column-${code}`} style={sx("display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;background:#E9ECEA;min-height:420px")}>
              <div style={sx("display:flex;align-items:center;justify-content:space-between;padding:4px 4px 6px")}><span style={sx("font-size:13px;font-weight:700;color:#0B1F3A")}>{name}</span><span style={sx("font-size:12px;font-weight:700;color:#4C5A6E")}>{cards.length}</span></div>
              {cards.map((l) => (
                <div key={l.id} style={sx("padding:12px;border-radius:12px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:8px")}>
                  <a href={`/admin/leads/${l.id}`} style={sx("font-size:14px;font-weight:700;color:#0B1F3A")}>{l.name || l.email}</a>
                  <div style={sx("display:flex;align-items:center;gap:8px;font-size:12px;color:#4C5A6E")}><ScoreChip score={l.score ?? null} small />{l.campaign ?? "Organic"}</div>
                  <StageSelect accountId={l.id} stage={l.stage ?? "new"} stages={STAGES} compact />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
