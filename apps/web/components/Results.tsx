"use client";

import { sx } from "../lib/sx.ts";
import type { ScoreResult } from "../lib/types.ts";
import { chips, dash, longDate, panelView, pillarRows, shortProgress, CAP_NOTE, type PanelView } from "../lib/view.ts";
import { DISCLAIMER, Tick } from "./Chrome.tsx";
import { LeadForm, type FormState } from "./LeadForm.tsx";

const chipCss = "display:inline-flex;align-items:center;min-height:32px;padding:6px 14px;border-radius:999px;background:rgba(245,246,244,0.08);border:1px solid rgba(245,246,244,0.16);font-size:13px;font-weight:600;color:#E6EAEE";

function ScoreCard({ r }: { r: ScoreResult }) {
  const score = r.score ?? 0;
  return (
    <div className="mt-pad" style={sx("position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px")}>
      <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5")}>Your Manager-Readiness score</span>
      <div style={sx("position:relative;width:clamp(180px,22vw,220px);aspect-ratio:1")}>
        <svg viewBox="0 0 200 200" style={sx("width:100%;height:100%;transform:rotate(-90deg)")}><circle cx="100" cy="100" r="88" fill="none" stroke="rgba(245,246,244,0.14)" strokeWidth="12"></circle><circle cx="100" cy="100" r="88" fill="none" stroke="#9FDCBE" strokeWidth="12" strokeLinecap="round" strokeDasharray={dash(score)}></circle></svg>
        <div style={sx("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center")}><span data-testid="score" style={sx("font-family:var(--site-font-display);font-size:clamp(64px,7vw,80px);font-weight:700;letter-spacing:-0.05em;line-height:0.9;color:#F5F6F4;font-variant-numeric:tabular-nums")}>{score}</span><span style={sx("font-size:14px;font-weight:600;color:#C3CBD5;margin-top:4px")}>out of 100</span></div>
      </div>
      <div style={sx("display:flex;flex-direction:column;align-items:center;gap:6px")}>
        <span data-testid="band" style={sx("font-family:var(--site-font-display);font-size:clamp(24px,2.6vw,30px);font-weight:700;letter-spacing:-0.025em;line-height:1.1;color:#9FDCBE")}>{r.band.name}</span>
        <span style={sx("font-size:15px;line-height:1.45;color:rgba(245,246,244,0.82)")}>{r.band.meaning}</span>
      </div>
      <div style={sx("display:flex;flex-wrap:wrap;justify-content:center;gap:8px")}>
        {chips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
    </div>
  );
}

function ShortCard({ r }: { r: ScoreResult }) {
  return (
    <div className="mt-pad" style={sx("position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:18px")}>
      <span style={sx("width:56px;height:56px;border-radius:18px;background:rgba(245,246,244,0.1);color:#9FDCBE;display:flex;align-items:center;justify-content:center")}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg></span>
      <h1 data-testid="come-back" style={sx("font-family:var(--site-font-display);font-size:clamp(28px,3.4vw,40px);font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:#F5F6F4;margin:0;text-wrap:balance")}>Not enough history yet. Come back on {longDate(r.come_back_date!)} for your score.</h1>
      <div style={sx("display:flex;flex-wrap:wrap;gap:8px")}>
        {chips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
      <div style={sx("width:100%;display:flex;flex-direction:column;gap:12px;padding-top:18px;border-top:1px solid rgba(245,246,244,0.16)")}>
        {shortProgress(r).map((p) => (
          <div key={p.label} style={sx("display:flex;flex-direction:column;gap:8px")}><div style={sx("display:flex;justify-content:space-between;font-size:14px;color:rgba(245,246,244,0.82)")}><span>{p.label}</span><span style={sx("font-weight:700;color:#F5F6F4")}>{p.value}</span></div><div style={sx("height:6px;border-radius:999px;background:rgba(245,246,244,0.14);overflow:hidden")}><div style={{ ...sx("height:100%;background:#9FDCBE;border-radius:999px"), width: p.w }}></div></div></div>
        ))}
      </div>
    </div>
  );
}

const ExclaimIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5"></path><path d="M12 17h.01"></path></svg>
);

export function FlagPanel({ view }: { view: PanelView }) {
  if (view.kind === "none") {
    return (
      <div data-testid="flags-none" style={sx("display:flex;align-items:flex-start;gap:14px;padding:20px 22px;border-radius:20px;background:#E7F1ED")}>
        <span style={sx("width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Tick size={16} width="3" /></span>
        <div style={sx("display:flex;flex-direction:column;gap:4px")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A")}>No red flags found</span><span style={sx("font-size:14px;line-height:1.5;color:#1C2430")}>No martingale, grid trading or blown account in your history.</span></div>
      </div>
    );
  }
  return (
    <div data-testid="flags" style={sx("display:flex;flex-direction:column;gap:10px")}>
      {view.summary && <span data-testid="flags-summary" style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A;padding:0 4px")}>{view.summary}</span>}
      {view.rows.map((row) => row.capping ? (
        <div key={row.code} role="note" data-flag={row.code} style={sx("display:flex;align-items:flex-start;gap:14px;padding:20px 22px;border-radius:20px;background:#F5E4E1;border:1px solid rgba(162,59,46,0.25)")}>
          <span style={sx("width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#A23B2E;display:flex;align-items:center;justify-content:center")}><ExclaimIcon /></span>
          <div style={sx("display:flex;flex-direction:column;gap:4px")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#7A2A20")}>{row.text}</span>{row.showCapNote && <span style={sx("font-size:14px;line-height:1.5;color:#1C2430")}>{CAP_NOTE}</span>}</div>
        </div>
      ) : (
        <div key={row.code} role="note" data-flag={row.code} style={sx("display:flex;align-items:flex-start;gap:14px;padding:20px 22px;border-radius:20px;background:#F5EBD6;border:1px solid rgba(169,120,31,0.25)")}>
          <span style={sx("width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#A9781F;display:flex;align-items:center;justify-content:center")}><ExclaimIcon /></span>
          <div style={sx("display:flex;flex-direction:column;gap:4px")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#5C4210")}>{row.text}</span></div>
        </div>
      ))}
    </div>
  );
}

function Details({ r }: { r: ScoreResult }) {
  return (
    <div className="mt-a-details" style={sx("display:flex;flex-direction:column;gap:16px;min-width:0")}>
      <div className="mt-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:10px")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Key insight</span>
        <p data-testid="insight" style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(24px,2.8vw,32px);font-weight:700;letter-spacing:-0.03em;line-height:1.12;color:#0B1F3A;text-wrap:balance")}>{r.headline?.text}</p>
      </div>
      <div className="mt-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>Your five pillars</span>
        {pillarRows(r.pillars ?? []).map((p) => (
          <div key={p.name} data-testid="pillar" style={sx("display:flex;flex-direction:column;gap:8px")}>
            <div style={sx("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}><span style={sx("font-size:15px;font-weight:600;color:#0B1F3A")}>{p.name} <span style={sx("font-weight:500;color:#6B7684")}>· {p.pct}</span></span><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{p.score}</span></div>
            <div style={sx("height:8px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px;animation:mtfill 0.9s ease"), width: p.w }}></div></div>
          </div>
        ))}
      </div>
      <FlagPanel view={panelView(r.red_flag_panel)} />
    </div>
  );
}

export function Results({ r, initialForm, showFormErrors }: { r: ScoreResult; initialForm?: Partial<FormState>; showFormErrors?: boolean }) {
  const isShort = r.status === "not_enough_history";
  return (
    <section className="mt-wrap" style={sx("padding-top:clamp(16px,3vw,40px);padding-bottom:clamp(56px,8vw,104px)")}>
      <div className="mt-res">
        <div className="mt-a-score" style={sx("position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(168deg,#0B1F3A 0%,#0D2C3F 40%,#0E4A44 82%,#0E6B4F 122%);color:#F5F6F4")}>
          <div aria-hidden="true" style={sx("position:absolute;right:-30%;bottom:-40%;width:90%;height:90%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.28),rgba(63,145,116,0))")}></div>
          {isShort ? <ShortCard r={r} /> : <ScoreCard r={r} />}
        </div>
        <LeadForm comeBack={isShort && r.come_back_date ? longDate(r.come_back_date) : null} initial={initialForm} showErrors={showFormErrors} />
        {!isShort && <Details r={r} />}
      </div>
      <p style={sx("margin:28px 0 0;max-width:80ch;font-size:13px;line-height:1.6;color:#6B7684")}>{DISCLAIMER}</p>
    </section>
  );
}

