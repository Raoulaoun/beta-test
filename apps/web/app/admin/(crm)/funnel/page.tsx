import { sx } from "../../../../lib/sx.ts";
import { funnel } from "../../../../lib/server/admin.ts";
import { h1, th, theadRow } from "../../../../components/admin/ui.tsx";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const n = (x: number) => x.toLocaleString("en-US");

export default async function FunnelPage() {
  const rows = await funnel(30);
  const tot = rows.reduce((t, r) => [t[0] + r.visits, t[1] + r.uploads, t[2] + r.scored, t[3] + r.leads], [0, 0, 0, 0]);
  const steps = ["Visits", "Uploads", "Scored", "Leads"];
  return (
    <>
      <div style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
        <h1 style={sx(h1)}>Funnel by campaign</h1><span style={sx("font-size:13px;color:#6B7684")}>Last 30 days</span>
      </div>
      <div style={sx("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px")}>
        {steps.map((label, i) => (
          <div key={label} data-testid={`step-${label.toLowerCase()}`} style={sx("padding:20px;border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:10px")}>
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4C5A6E")}>{label}</span>
            <span style={sx("font-family:var(--site-font-display);font-size:34px;font-weight:700;letter-spacing:-0.03em;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{n(tot[i])}</span>
            <div style={sx("height:8px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px"), width: `${pct(tot[i], tot[0])}%` }}></div></div>
            <span style={{ ...sx("font-size:12.5px"), color: i === 3 ? "#A9781F" : "#4C5A6E" }}>{i === 0 ? "All campaigns" : `${pct(tot[i], tot[i - 1])}% of previous step · ${100 - pct(tot[i], tot[i - 1])}% drop-off`}</span>
          </div>
        ))}
      </div>
      <div style={sx("border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;overflow:hidden")}>
        <table style={sx("width:100%;border-collapse:collapse;font-size:14px")}>
          <thead><tr style={sx(theadRow)}><th style={sx("padding:12px 18px;font-weight:700")}>Campaign</th><th style={sx(th + ";text-align:right")}>Visits</th><th style={sx(th + ";text-align:right")}>Uploads</th><th style={sx(th + ";text-align:right")}>Scored</th><th style={sx(th + ";text-align:right")}>Leads</th><th style={sx(th)}>Visit → lead</th><th style={sx("padding:12px 18px;font-weight:700;text-align:right")}>Drop-off after score</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const drop = r.scored ? 100 - pct(r.leads, r.scored) : 0;
              const conv = r.visits ? (r.leads / r.visits) * 100 : 0;
              return (
                <tr key={r.campaign} style={sx("border-top:1px solid #EEF0F2")}>
                  <td style={sx("padding:14px 18px;font-weight:700;color:#0B1F3A")}>{r.campaign}</td>
                  <td style={sx("padding:14px 12px;text-align:right;font-variant-numeric:tabular-nums")}>{n(r.visits)}</td>
                  <td style={sx("padding:14px 12px;text-align:right;font-variant-numeric:tabular-nums")}>{n(r.uploads)}</td>
                  <td style={sx("padding:14px 12px;text-align:right;font-variant-numeric:tabular-nums")}>{n(r.scored)}</td>
                  <td style={sx("padding:14px 12px;text-align:right;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{n(r.leads)}</td>
                  <td style={sx("padding:14px 12px")}><div style={sx("display:flex;align-items:center;gap:10px")}><div style={sx("width:120px;height:6px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F"), width: `${Math.min(100, Math.round(conv) * 3)}%` }}></div></div><span style={sx("font-size:13px;color:#4C5A6E")}>{conv.toFixed(1)}%</span></div></td>
                  <td style={{ ...sx("padding:14px 18px;text-align:right;font-weight:700"), color: drop > 60 ? "#A23B2E" : drop > 50 ? "#A9781F" : "#0E6B4F" }}>{r.scored ? `${drop}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div style={sx("padding:40px;text-align:center;font-size:14px;color:#6B7684")}>No visits in the last 30 days.</div>}
      </div>
    </>
  );
}
