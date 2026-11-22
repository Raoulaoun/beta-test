"use client";

import { sx } from "../lib/sx.ts";
import type { ScoreResult } from "../lib/types.ts";
import { chips, coachMore, dash, EXPORT_GUIDE_LINK, starterChips, panelView, pillarRows, progressRows, CAP_NOTE, type PanelView } from "../lib/view.ts";
import { DISCLAIMER, Tick } from "./Chrome.tsx";
import { LeadForm, useLeadForm, type FormState } from "./LeadForm.tsx";
import { FormModal } from "./FormModal.tsx";
import { SavedBanner, SignedOutBanner } from "./SignedOutBanner.tsx";
import { useEffect, useRef, useState } from "react";
import { progress } from "../lib/client.ts";

const chipCss = "display:inline-flex;align-items:center;min-height:32px;padding:6px 14px;border-radius:999px;background:rgba(245,246,244,0.08);border:1px solid rgba(245,246,244,0.16);font-size:13px;font-weight:600;color:#E6EAEE";

// Progress bars from the design's not-enough-history card, reused under early and starter.
// Early score (design/flow screen=early): the early line, then months and trades.
function Progress({ r }: { r: ScoreResult }) {
  return (
    <div data-testid="progress" style={sx("width:100%;display:flex;flex-direction:column;gap:14px;padding-top:18px;border-top:1px solid rgba(245,246,244,0.16);text-align:left")}>
      {r.early && <p data-testid="early-line" style={sx("margin:0;font-size:15px;line-height:1.5;color:#F5F6F4;text-wrap:pretty")}>{r.early.line}</p>}
      {progressRows(r).map((p) => (
        <div key={p.label} style={sx("display:flex;flex-direction:column;gap:8px")}><div style={sx("display:flex;justify-content:space-between;font-size:14px;color:rgba(245,246,244,0.82)")}><span>{p.label}</span><span style={sx("font-weight:700;color:#F5F6F4")}>{p.value}</span></div><div style={sx("height:6px;border-radius:999px;background:rgba(245,246,244,0.14);overflow:hidden")}><div style={{ ...sx("height:100%;background:#9FDCBE;border-radius:999px"), width: p.w }}></div></div></div>
      ))}
    </div>
  );
}

function ScoreCard({ r }: { r: ScoreResult }) {
  const score = r.score ?? 0;
  return (
    <div className="mt-pad" style={sx("position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px")}>
      <span data-testid="score-label" style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5")}>{r.early ? r.early.label : "Your Manager-Readiness score"}</span>
      <div style={sx("position:relative;width:clamp(180px,22vw,220px);aspect-ratio:1")}>
        <svg viewBox="0 0 200 200" style={sx("width:100%;height:100%;transform:rotate(-90deg)")}><circle cx="100" cy="100" r="88" fill="none" stroke="rgba(245,246,244,0.14)" strokeWidth="12"></circle><circle cx="100" cy="100" r="88" fill="none" stroke="#9FDCBE" strokeWidth="12" strokeLinecap="round" strokeDasharray={dash(score)}></circle></svg>
        <div style={sx("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center")}><span data-testid="score" style={sx("font-family:var(--site-font-display);font-size:clamp(64px,7vw,80px);font-weight:700;letter-spacing:-0.05em;line-height:0.9;color:#F5F6F4;font-variant-numeric:tabular-nums")}>{score}</span><span style={sx("font-size:14px;font-weight:600;color:#C3CBD5;margin-top:4px")}>out of 100</span></div>
      </div>
      <div style={sx("display:flex;flex-direction:column;align-items:center;gap:6px")}>
        <span data-testid="band" style={sx("font-family:var(--site-font-display);font-size:clamp(24px,2.6vw,30px);font-weight:700;letter-spacing:-0.025em;line-height:1.1;color:#9FDCBE")}>{r.band?.name}</span>
        <span style={sx("font-size:15px;line-height:1.45;color:rgba(245,246,244,0.82)")}>{r.band?.meaning}</span>
      </div>
      <div style={sx("display:flex;flex-wrap:wrap;justify-content:center;gap:8px")}>
        {chips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
      {r.early && <Progress r={r} />}
    </div>
  );
}

// Starter read (design/flow screen=starter).
function StarterCard({ r }: { r: ScoreResult }) {
  const st = r.starter!;
  return (
    <div className="mt-pad" style={sx("position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:16px")}>
      <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5")}>Starter read</span>
      <h1 data-testid="starter-heading" style={sx("font-family:var(--site-font-display);font-size:clamp(30px,3.6vw,42px);font-weight:700;letter-spacing:-0.035em;line-height:1.05;color:#F5F6F4;margin:0")}>{st.heading}</h1>
      <p style={sx("margin:0;font-size:16px;line-height:1.55;color:rgba(245,246,244,0.88);max-width:46ch;text-wrap:pretty")}>{st.line}</p>
      <div style={sx("display:flex;flex-wrap:wrap;gap:8px")}>
        {starterChips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
    </div>
  );
}

// Starter metrics (design/flow screen=starter): label, value, and one tip — the metric's
// first action from docs/advice-texts.md, or its strength line when it already scores full.
function StarterDetails({ r }: { r: ScoreResult }) {
  return (
    <div className="mt-a-details" style={sx("display:flex;flex-direction:column;gap:12px;min-width:0")}>
      {r.starter!.metrics.map((m) => (
        <div key={m.key} data-testid="starter-metric" data-kind={m.kind} style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:20px;padding:20px 22px;display:flex;flex-direction:column;gap:8px")}>
          <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>{m.name}</span>
          <span style={sx("font-family:var(--site-font-display);font-size:26px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;color:#0B1F3A")}>{m.display}</span>
          <p style={sx("margin:4px 0 0;padding-top:12px;border-top:1px solid #DDE2E7;font-size:14px;line-height:1.5;color:#1C2430;text-wrap:pretty")}>
            <strong style={sx("color:#0E6B4F")}>Tip · </strong>{m.kind === "advice" && m.actions?.length ? m.actions[0] : m.text}
          </p>
        </div>
      ))}
    </div>
  );
}

// Short-period nudge (design/flow: amber note with "See the export guide").
function Nudge({ text, onExport }: { text: string; onExport: (e: React.MouseEvent) => void }) {
  return (
    <div role="note" data-testid="nudge" style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px 18px;margin-bottom:16px;border-radius:16px;background:#F5EBD6;border:1px solid rgba(169,120,31,0.35)")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A5A16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0")}><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
      <span style={sx("flex:1;min-width:220px;font-size:15px;line-height:1.5;color:#3D2C0B")}>{text}</span>
      <a href="/#export" onClick={onExport} style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:700;color:#7A5A16;text-decoration:underline;text-underline-offset:3px")}>{EXPORT_GUIDE_LINK}</a>
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

// Coach notes on the results screen (design/flow): the free top "working" and top
// "costing" note, and a link to the rest, which are in the full report.
function CoachNotes({ r, onMore }: { r: ScoreResult; onMore?: (el: HTMLElement) => void }) {
  const top = r.coach?.top;
  if (!top || (!top.working && !top.costing)) return null;
  const more = r.coach?.more ?? 0;
  const cap = "display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase";
  return (
    <div className="mt-pad" data-testid="coach-free" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:16px")}>
      <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>Your coach notes</span>
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px")}>
        {top.working && (
          <div style={sx("display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:18px;background:#E7F1ED")}>
            <span style={sx(cap + ";color:#0E6B4F")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>Working for you</span>
            <p style={sx("margin:0;font-size:15px;line-height:1.5;font-weight:500;color:#0B1F3A;text-wrap:pretty")}>{top.working.text}</p>
          </div>
        )}
        {top.costing && (
          <div style={sx("display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:18px;background:#F5EBD6")}>
            <span style={sx(cap + ";color:#7A5A16")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>Costing you</span>
            <p style={sx("margin:0;font-size:15px;line-height:1.5;font-weight:500;color:#3D2C0B;text-wrap:pretty")}>{top.costing.text}</p>
            {top.costing.action && <p style={sx("margin:0;padding-top:10px;border-top:1px solid rgba(122,90,22,0.2);font-size:14px;line-height:1.5;font-weight:700;color:#3D2C0B;text-wrap:pretty")}>{top.costing.action}</p>}
          </div>
        )}
      </div>
      {onMore && more > 0 && (
        <a href="#report" data-testid="coach-more" className="mt-hover-navy" onClick={(e) => { e.preventDefault(); onMore(e.currentTarget); }} style={sx("align-self:flex-start;display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:15px;font-weight:700;color:#0E6B4F")}>
          {coachMore(more)}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </a>
      )}
    </div>
  );
}

function Details({ r, onMore }: { r: ScoreResult; onMore?: (el: HTMLElement) => void }) {
  const pillarsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pillarsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { progress(r.result_id, r.access_token, "pillars"); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [r.result_id, r.access_token]);
  return (
    <div className="mt-a-details" style={sx("display:flex;flex-direction:column;gap:16px;min-width:0")}>
      <div className="mt-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:10px")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Key insight</span>
        <p data-testid="insight" style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(24px,2.8vw,32px);font-weight:700;letter-spacing:-0.03em;line-height:1.12;color:#0B1F3A;text-wrap:balance")}>{r.headline?.text}</p>
      </div>
      <div ref={pillarsRef} className="mt-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>Your five pillars</span>
        {pillarRows(r.pillars ?? []).map((p) => (
          <div key={p.name} data-testid="pillar" style={sx("display:flex;flex-direction:column;gap:8px")}>
            <div style={sx("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}><span style={sx("font-size:15px;font-weight:600;color:#0B1F3A")}>{p.name} <span style={sx("font-weight:500;color:#6B7684")}>· {p.pct}</span></span><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{p.score}</span></div>
            <div style={sx("height:8px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px;animation:mtfill 0.9s ease"), width: p.w }}></div></div>
          </div>
        ))}
      </div>
      <CoachNotes r={r} onMore={onMore} />
      <FlagPanel view={panelView(r.red_flag_panel)} />
    </div>
  );
}

export type FormOpen = { returnTo: HTMLElement | null } | null;

// Primary button style from design/flow ("Send my full report").
const ctaCss = "height:56px;width:100%;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer";
export const FULL_REPORT_CTA = "Get my full report";

// Phones: a sticky bar with the same button, shown only while neither the button under the
// score nor the inline form is on screen.
function StickyCta({ watch, onOpen }: { watch: string[]; onOpen: (el: HTMLElement) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = watch.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      setShow(els.length > 0 && els.every((el) => seen.get(el) === false));
    }, { rootMargin: "-96px 0px 0px 0px" }); // a sliver at the top edge does not count as on screen
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [watch.join("|")]);
  return (
    <div className="mt-sticky-cta" data-testid="sticky-cta" data-show={show} aria-hidden={!show}>
      <button type="button" tabIndex={show ? 0 : -1} onClick={(e) => onOpen(e.currentTarget)} style={sx(ctaCss)}>{FULL_REPORT_CTA}</button>
    </div>
  );
}

type ResultsProps = {
  r: ScoreResult; initialForm?: Partial<FormState>; showFormErrors?: boolean;
  onExport: (e: React.MouseEvent) => void; onSent?: (email: string) => void; onSignedIn?: () => void;
  formOpen?: FormOpen; onCloseForm?: () => void; onOpenForm?: (el: HTMLElement, source?: "results_button" | "coach_more") => void;
};

export function Results({ r, initialForm, showFormErrors, onExport, onSent, onSignedIn, formOpen = null, onCloseForm, onOpenForm }: ResultsProps) {
  const starter = r.score_type === "starter";
  // One form state for the inline form and the modal.
  const form = useLeadForm({ retestDefault: r.retest_default, initial: initialForm, showErrors: showFormErrors,
    resultId: r.result_id, token: r.access_token, onSent });
  const modal = !!formOpen;
  return (
    <section className="mt-wrap" style={sx("padding-top:clamp(16px,3vw,40px);padding-bottom:clamp(56px,8vw,104px)")}>
      {r.saved_to_account && <SavedBanner />}
      {r.known_account && !r.saved_to_account && <SignedOutBanner resultId={r.result_id} token={r.access_token} onSignedIn={() => onSignedIn?.()} />}
      {r.nudge && <Nudge text={r.nudge} onExport={onExport} />}
      <div className="mt-res">
        <div className="mt-a-score" style={sx("display:flex;flex-direction:column;gap:16px;min-width:0")}>
          <div style={sx("position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(168deg,#0B1F3A 0%,#0D2C3F 40%,#0E4A44 82%,#0E6B4F 122%);color:#F5F6F4")}>
            <div aria-hidden="true" style={sx("position:absolute;right:-30%;bottom:-40%;width:90%;height:90%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.28),rgba(63,145,116,0))")}></div>
            {starter ? <StarterCard r={r} /> : <ScoreCard r={r} />}
          </div>
          <button id="mt-full-report" type="button" data-testid="full-report-cta" onClick={(e) => onOpenForm?.(e.currentTarget)} style={sx(ctaCss)}>{FULL_REPORT_CTA}</button>
        </div>
        <LeadForm form={form} idp="mt-" variant="inline" turnstile={!modal} />
        {starter ? <StarterDetails r={r} /> : <Details r={r} onMore={(el) => onOpenForm?.(el, "coach_more")} />}
      </div>
      <p style={sx("margin:28px 0 0;max-width:80ch;font-size:13px;line-height:1.6;color:#6B7684")}>{DISCLAIMER}</p>
      {<StickyCta watch={["mt-full-report", "report"]} onOpen={(el) => onOpenForm?.(el)} />}
      {modal && (
        <FormModal titleId="mt-m-title" firstFieldId="mt-m-name" returnTo={formOpen!.returnTo} onClose={() => onCloseForm?.()}>
          <LeadForm form={form} idp="mt-m-" variant="modal" turnstile />
        </FormModal>
      )}
    </section>
  );
}
