import { sx } from "../../../../lib/sx.ts";
import { LEFT_AT_LABEL, WEAKNESS_LABEL, bandLabel, dropoffs, funnel } from "../../../../lib/server/admin.ts";
import { ScoreChip, fmtDate, h1, theadRow } from "../../../../components/admin/ui.tsx";

const stat = "padding:20px;border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:6px";
const statCap = "font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4C5A6E";
const statNum = "font-family:var(--site-font-display);font-size:34px;font-weight:700;color:#0B1F3A";
const th = "padding:12px;font-weight:700";

export default async function DropoffsPage() {
  const [list, f] = await Promise.all([dropoffs(30), funnel(30)]);
  const scored = f.reduce((t, r) => t + r.scored, 0);
  const recovered = f.reduce((t, r) => t + r.exitRecovered, 0);
  const high = list.filter((d) => (d.score ?? 0) >= 60).length;
  return (
    <>
      <div><h1 style={sx(h1)}>Drop-offs</h1><p style={sx("margin:6px 0 0;font-size:14px;color:#6B7684")}>Scored but didn&apos;t fill the form. Anonymous sessions, no contact details stored.</p></div>
      <div style={sx("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px")}>
        <div style={sx(stat)}><span style={sx(statCap)}>Drop-offs, 30 days</span><span data-testid="dropoff-count" style={sx(statNum)}>{list.length}</span><span style={sx("font-size:13px;color:#4C5A6E")}>{scored ? Math.round((list.length / scored) * 100) : 0}% of scored sessions</span></div>
        <div style={sx(stat)}><span style={sx(statCap)}>Scoring 60+</span><span style={sx(statNum)}>{high}</span><span style={sx("font-size:13px;color:#4C5A6E")}>Highest-value drop-offs</span></div>
        <div style={sx(stat)}><span style={sx(statCap)}>Exit prompt recovered</span><span data-testid="exit-recovered" style={sx(statNum)}>{recovered}</span><span style={sx("font-size:13px;color:#4C5A6E")}>Filled the form after the prompt</span></div>
      </div>
      <div style={sx("border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;overflow:hidden")}>
        <table style={sx("width:100%;border-collapse:collapse;font-size:14px")}>
          <thead><tr style={sx(theadRow)}><th style={sx("padding:12px 18px;font-weight:700")}>Session</th><th style={sx(th)}>Date</th><th style={sx(th)}>Score</th><th style={sx(th)}>Band</th><th style={sx(th)}>Top weakness</th><th style={sx(th)}>Campaign</th><th style={sx(th)}>Device</th><th style={sx("padding:12px 18px;font-weight:700")}>Left at</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} data-testid="dropoff-row" style={sx("border-top:1px solid #EEF0F2")}>
                <td style={sx("padding:12px 18px;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#4C5A6E")}>anon-{d.id.slice(0, 4)}</td>
                <td style={sx("padding:12px;color:#4C5A6E;white-space:nowrap")}>{fmtDate(d.createdAt)}</td>
                <td style={sx("padding:12px")}><ScoreChip score={d.score ?? null} /></td>
                <td style={sx("padding:12px;white-space:nowrap")}>{d.scoreType === "starter" ? "Starter read" : bandLabel(d.band ?? null)}</td>
                <td style={sx("padding:12px")}>{d.topWeakness ? WEAKNESS_LABEL[d.topWeakness] ?? d.topWeakness : "—"}</td>
                <td style={sx("padding:12px;color:#4C5A6E")}>{d.campaign ?? "Organic"}</td>
                <td style={sx("padding:12px;color:#4C5A6E")}>{d.device ?? "—"}</td>
                <td style={sx("padding:12px 18px;color:#4C5A6E")}>{LEFT_AT_LABEL[d.leftAt ?? "score"] ?? d.leftAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div style={sx("padding:40px;text-align:center;font-size:14px;color:#6B7684")}>No drop-offs in the last 30 days.</div>}
      </div>
    </>
  );
}
