"use client";

import { sx } from "../lib/sx.ts";
import type { ScoreResult } from "../lib/types.ts";
import { chips, dash, nudgeParts, starterChips, panelView, pillarRows, progressRows, CAP_NOTE, type PanelView } from "../lib/view.ts";
import { DISCLAIMER, Tick } from "./Chrome.tsx";
import { LeadForm, useLeadForm, type FormState } from "./LeadForm.tsx";
import { FormModal } from "./FormModal.tsx";
import { SavedBanner } from "./SavedBanner.tsx";
import { SignedOutBanner } from "./SignedOutBanner.tsx";
import { useEffect, useRef, useState } from "react";
import { progress } from "../lib/client.ts";

const chipCss = "display:inline-flex;align-items:center;min-height:32px;padding:6px 14px;border-radius:999px;background:rgba(245,246,244,0.08);border:1px solid rgba(245,246,244,0.16);font-size:13px;font-weight:600;color:#E6EAEE";

// Progress bars from the design's not-enough-history card, reused under early and starter.
function Progress({ r }: { r: ScoreResult }) {
  return (
    <div data-testid="progress" style={sx("width:100%;display:flex;flex-direction:column;gap:12px;padding-top:18px;border-top:1px solid rgba(245,246,244,0.16);text-align:left")}>
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
      {r.early && <p data-testid="early-line" style={sx("margin:0;max-width:44ch;font-size:15px;line-height:1.5;color:#F5F6F4;text-wrap:pretty")}>{r.early.line}</p>}
      <div style={sx("display:flex;flex-wrap:wrap;justify-content:center;gap:8px")}>
        {chips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
      {r.early && <Progress r={r} />}
    </div>
  );
}

// Starter read: the design's not-enough-history card layout, with the starter copy.
function StarterCard({ r }: { r: ScoreResult }) {
  const st = r.starter!;
  return (
    <div className="mt-pad" style={sx("position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:18px")}>
      <span style={sx("width:56px;height:56px;border-radius:18px;background:rgba(245,246,244,0.1);color:#9FDCBE;display:flex;align-items:center;justify-content:center")}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="m7 15 4-4 3 3 5-6"></path></svg></span>
      <h1 data-testid="starter-heading" style={sx("font-family:var(--site-font-display);font-size:clamp(28px,3.4vw,40px);font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:#F5F6F4;margin:0;text-wrap:balance")}>{st.heading}</h1>
      <p style={sx("margin:0;font-size:16px;line-height:1.55;color:rgba(245,246,244,0.82);text-wrap:pretty")}>{st.line}</p>
      <div style={sx("display:flex;flex-wrap:wrap;gap:8px")}>
        {starterChips(r).map((c) => <span key={c} style={sx(chipCss)}>{c}</span>)}
      </div>
      <Progress r={r} />
    </div>
  );
}

// Starter metrics, in the design's white card style (as the pillars card).
function StarterDetails({ r }: { r: ScoreResult }) {
  return (
    <div className="mt-a-details" style={sx("display:flex;flex-direction:column;gap:16px;min-width:0")}>
      {r.starter!.metrics.map((m) => (
        <div key={m.key} data-testid="starter-metric" data-kind={m.kind} className="mt-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:12px")}>
          <div style={sx("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}>
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>{m.name}</span>
            <span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{m.display}</span>
          </div>
          <p style={sx("margin:0;font-size:16px;line-height:1.55;color:#0B1F3A;text-wrap:pretty")}>{m.text}</p>
          {m.actions && (
            <ul style={sx("list-style:none;margin:0;padding:14px 16px;border-radius:16px;background:#E7F1ED;display:flex;flex-direction:column;gap:8px")}>
              {m.actions.map((a) => (
                <li key={a} style={sx("display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.45;font-weight:500;color:#0B1F3A")}><Tick size={16} width="2.6" color="#0E6B4F" style={sx("flex-shrink:0;margin-top:2px")} />{a}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// Short-period nudge, in the design's amber caution style.
function Nudge({ text, onExport }: { text: string; onExport: (e: React.MouseEvent) => void }) {
  const [before, link] = nudgeParts(text);
  return (
    <div role="note" data-testid="nudge" style={sx("margin-bottom:16px;display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:16px;background:#F5EBD6")}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A9781F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0;margin-top:2px")}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
      <span style={sx("font-size:15px;line-height:1.5;font-weight:500;color:#5C4210")}>{before}{link && <a href="/#export" onClick={onExport} style={sx("color:#5C4210;font-weight:700;border-bottom:1px solid rgba(92,66,16,0.4)")}>{link}</a>}</span>
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
  onExport: (e: React.MouseEvent) => void; onSent?: (email: string) => void;
  formOpen?: FormOpen; onCloseForm?: () => void; onOpenForm?: (el: HTMLElement) => void;
};

export function Results({ r, initialForm, showFormErrors, onExport, onSent, formOpen = null, onCloseForm, onOpenForm }: ResultsProps) {
  const starter = r.score_type === "starter";
  // One form state for the inline form and the modal.
  const form = useLeadForm({ retestDefault: r.retest_default, initial: initialForm, showErrors: showFormErrors,
    resultId: r.result_id, token: r.access_token, onSent });
  const modal = !!formOpen && !r.saved_to_account;
  return (
    <section className="mt-wrap" style={sx("padding-top:clamp(16px,3vw,40px);padding-bottom:clamp(56px,8vw,104px)")}>
      {r.known_account && !r.saved_to_account && <SignedOutBanner resultId={r.result_id} token={r.access_token} />}
      {r.nudge && <Nudge text={r.nudge} onExport={onExport} />}
      <div className="mt-res">
        <div className="mt-a-score" style={sx("display:flex;flex-direction:column;gap:16px;min-width:0")}>
          <div style={sx("position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(168deg,#0B1F3A 0%,#0D2C3F 40%,#0E4A44 82%,#0E6B4F 122%);color:#F5F6F4")}>
            <div aria-hidden="true" style={sx("position:absolute;right:-30%;bottom:-40%;width:90%;height:90%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.28),rgba(63,145,116,0))")}></div>
            {starter ? <StarterCard r={r} /> : <ScoreCard r={r} />}
          </div>
          {!r.saved_to_account && (
            <button id="mt-full-report" type="button" data-testid="full-report-cta" onClick={(e) => onOpenForm?.(e.currentTarget)} style={sx(ctaCss)}>{FULL_REPORT_CTA}</button>
          )}
        </div>
        {r.saved_to_account
          ? <SavedBanner />
          : <LeadForm form={form} idp="mt-" variant="inline" turnstile={!modal} />}
        {starter ? <StarterDetails r={r} /> : <Details r={r} />}
      </div>
      <p style={sx("margin:28px 0 0;max-width:80ch;font-size:13px;line-height:1.6;color:#6B7684")}>{DISCLAIMER}</p>
      {!r.saved_to_account && <StickyCta watch={["mt-full-report", "report"]} onOpen={(el) => onOpenForm?.(el)} />}
      {modal && (
        <FormModal titleId="mt-m-title" firstFieldId="mt-m-name" returnTo={formOpen!.returnTo} onClose={() => onCloseForm?.()}>
          <LeadForm form={form} idp="mt-m-" variant="modal" turnstile />
        </FormModal>
      )}
    </section>
  );
}
