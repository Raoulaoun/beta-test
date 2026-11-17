import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { sx } from "../../../../../lib/sx.ts";
import { adminFromCookie } from "../../../../../lib/server/adminAuth.ts";
import { MANAGE_LABEL, STAGES, bandLabel, leadDetail } from "../../../../../lib/server/admin.ts";
import type { ScoreResult } from "../../../../../lib/types.ts";
import { NoteForm, StageSelect } from "../../../../../components/admin/LeadActions.tsx";
import { fmtDate, fmtPhone, waLink } from "../../../../../components/admin/ui.tsx";

const box = "padding:22px 24px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:12px";
const cap = "font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4C5A6E";
const FLAGS: [string, string][] = [["martingale", "Martingale"], ["grid", "Grid trading"], ["blown_account", "Blown account"], ["no_stops", "No stop losses"], ["losses_held_open", "Losses held open"]];
const C = 2 * Math.PI * 88;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = (await adminFromCookie((await headers()).get("cookie")))!;
  const d = await leadDetail(id);
  if (!d) notFound();
  const { account: a, results } = d;
  const latest = results.find((r) => r.accountId === a.id) ?? results[0];
  const payload = latest?.payload as ScoreResult | undefined;
  const found = new Set([...(latest?.redFlags ?? []), ...(latest?.notes ?? [])]);
  const wa = waLink(a.phone, a.name, admin.name);
  const first = results[results.length - 1];
  return (
    <>
      <a href="/admin" style={sx("align-self:flex-start;display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:14px;font-weight:600;color:#0E6B4F")}>← All leads</a>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7")}>
        <div style={sx("display:flex;flex-direction:column;gap:6px")}>
          <h1 data-testid="lead-name" style={sx("margin:0;font-family:var(--site-font-display);font-size:30px;font-weight:700;letter-spacing:-0.03em;color:#0B1F3A")}>{a.name || a.email}</h1>
          <span style={sx("font-size:14px;color:#4C5A6E")}>{a.email} · {fmtPhone(a.phone)} · Manages: {MANAGE_LABEL[a.managingForOthers ?? ""] ?? "—"}</span>
          <span style={sx("font-size:13px;color:#6B7684")}>{latest?.campaign ?? "Organic"} · {latest?.broker ?? "—"} · first scored {first ? fmtDate(first.createdAt) : "—"}</span>
        </div>
        <div style={sx("display:flex;align-items:flex-end;gap:12px")}>
          <StageSelect accountId={a.id} stage={d.stage} stages={STAGES} />
          {wa && <a href={wa} target="_blank" rel="noopener" style={sx("display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase")}>WhatsApp</a>}
        </div>
      </div>
      <div style={sx("display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:20px;align-items:start")}>
        <div style={sx("display:flex;flex-direction:column;gap:20px")}>
          <div style={sx("padding:24px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7;display:grid;grid-template-columns:180px minmax(0,1fr);gap:28px;align-items:center")}>
            <div style={sx("position:relative;width:180px;height:180px")}>
              <svg viewBox="0 0 200 200" style={sx("width:100%;height:100%;transform:rotate(-90deg)")}><circle cx="100" cy="100" r="88" fill="none" stroke="#E7F1ED" strokeWidth="12"></circle><circle cx="100" cy="100" r="88" fill="none" stroke="#0E6B4F" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(C * (latest?.score ?? 0) / 100).toFixed(1)} ${C.toFixed(1)}`}></circle></svg>
              <div style={sx("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center")}><span style={sx("font-family:var(--site-font-display);font-size:56px;font-weight:700;letter-spacing:-0.05em;line-height:0.9;color:#0B1F3A")}>{latest?.score ?? "—"}</span><span style={sx("font-size:12px;font-weight:700;color:#0E6B4F;margin-top:6px;text-align:center;padding:0 16px")}>{latest?.scoreType === "starter" ? "Starter read" : bandLabel(latest?.band ?? null)}{latest?.scoreType === "early" ? " · Early score" : ""}</span></div>
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:12px")}>
              {(payload?.pillars ?? []).map((p) => {
                const v = Math.floor(p.score + 0.5);
                return <div key={p.key} style={sx("display:flex;flex-direction:column;gap:6px")}><div style={sx("display:flex;justify-content:space-between;font-size:13.5px")}><span style={sx("font-weight:600;color:#0B1F3A")}>{p.name}</span><span style={sx("font-weight:700;color:#0B1F3A")}>{v}</span></div><div style={sx("height:6px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;border-radius:999px"), width: `${v}%`, background: v < 60 ? "#A9781F" : "#0E6B4F" }}></div></div></div>;
              })}
            </div>
          </div>
          <div style={sx(box)}>
            <span style={sx(cap)}>Red flags</span>
            {FLAGS.map(([code, name]) => {
              const on = found.has(code);
              return <div key={code} style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #EEF0F2")}><span style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>{name}</span><span style={{ ...sx("padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700"), background: on ? "#F5E4E1" : "#E7F1ED", color: on ? "#A23B2E" : "#0E6B4F" }}>{on ? "Found" : "Clear"}</span></div>;
            })}
            {payload?.headline && <span style={sx("font-size:13px;color:#4C5A6E")}>Key insight: {payload.headline.text}</span>}
          </div>
          <div style={sx(box)}>
            <span style={sx(cap)}>Retests</span>
            {results.map((r, i) => (
              <div key={r.id} style={sx("display:grid;grid-template-columns:140px 60px minmax(0,1fr);gap:12px;align-items:center;padding:10px 0;border-top:1px solid #EEF0F2;font-size:14px")}>
                <span style={sx("color:#4C5A6E")}>{fmtDate(r.createdAt)}</span>
                <span style={sx("font-weight:700;color:#0B1F3A")}>{r.score ?? "—"}</span>
                <span style={sx("color:#4C5A6E")}>{[i === 0 ? "Current score" : i === results.length - 1 ? "First test" : "Retest",
                  r.scoreType === "early" ? "early score" : r.scoreType === "starter" ? "starter read" : null,
                  r.pendingAccountId ? "waiting for sign-in" : null].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:20px")}>
          <div style={sx(box)}>
            <label htmlFor="ad-note" style={sx(cap)}>Notes</label>
            <NoteForm accountId={a.id} />
            {d.notes.map((n) => (
              <div key={n.id} data-testid="note" style={sx("padding:12px 0;border-top:1px solid #EEF0F2;display:flex;flex-direction:column;gap:4px")}><span style={sx("font-size:12px;color:#6B7684")}>{n.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" })} · {n.author}</span><span style={sx("font-size:14px;line-height:1.5;color:#1C2430;white-space:pre-wrap")}>{n.body}</span></div>
            ))}
          </div>
          <div style={sx("padding:22px 24px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:4px")}>
            <span style={sx(cap + ";margin-bottom:8px")}>Emails sent</span>
            {d.emails.length === 0 && <span style={sx("padding:10px 0;border-top:1px solid #EEF0F2;font-size:13px;color:#6B7684")}>No emails yet.</span>}
            {d.emails.map((e) => {
              const dot = e.status === "scheduled" ? "#7C8AA0" : e.status === "failed" ? "#A23B2E" : "#0E6B4F";
              return <div key={e.id} style={sx("display:grid;grid-template-columns:12px minmax(0,1fr) auto;gap:12px;align-items:start;padding:10px 0;border-top:1px solid #EEF0F2")}><span style={{ ...sx("width:8px;height:8px;border-radius:50%;margin-top:6px"), background: dot }}></span><div style={sx("display:flex;flex-direction:column;gap:2px")}><span style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>{e.subject ?? e.kind}</span><span style={sx("font-size:12px;color:#6B7684")}>{fmtDate(e.sentAt ?? e.scheduledFor ?? e.createdAt)}</span></div><span style={{ ...sx("font-size:12px;font-weight:700;text-transform:capitalize"), color: dot }}>{e.status}</span></div>;
            })}
          </div>
        </div>
      </div>
    </>
  );
}
