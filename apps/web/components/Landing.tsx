"use client";
import { sx } from "../lib/sx.ts";
import { ImageSlot } from "./ImageSlot.tsx";

const PILLAR_WEIGHTS: [string, number][] = [["Risk control", 25], ["Discipline", 20], ["Consistency", 20], ["Risk-adjusted return", 20], ["Track record depth", 15]];
const BANDS = [
  { range: "0–39", name: "Developing", desc: "Trading for yourself, not yet for others" },
  { range: "40–59", name: "Building", desc: "Promising, with clear gaps" },
  { range: "60–79", name: "Emerging Manager", desc: "Close, with a few things to fix" },
  { range: "80–100", name: "Professional Grade", desc: "Your record looks like a manager's" },
];
const DESKTOP_STEPS = [
  ["Screenshot: History tab", "Open the History tab (Toolbox, Ctrl+T)"],
  ["Screenshot: All History", "Right-click → All History"],
  ["Screenshot: Report menu", "Right-click → Report → Open XML (or HTML), save the file"],
  ["Screenshot: upload box", "Upload it here"],
];
const MOBILE_STEPS = [
  ["Screenshot: History, full period", "Open History, set the full period"],
  ["Screenshot: Request report", "Request your report (sent by email)"],
  ["Screenshot: Email attachment", "Save the attached file"],
  ["Screenshot: Upload on phone", "Upload it here"],
];

type Props = {
  tab: "desktop" | "mobile";
  setTab: (t: "desktop" | "mobile") => void;
  drag: boolean;
  setDrag: (d: boolean) => void;
  onFile: (f: File | undefined) => void;
};

function Step({ n, placeholder, text, ratio }: { n: number; placeholder: string; text: string; ratio: string }) {
  return (
    <div style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:14px")}>
      <ImageSlot placeholder={placeholder} ratio={ratio} />
      <div style={sx("display:flex;gap:12px;padding:0 6px 8px")}><span style={sx("width:28px;height:28px;flex-shrink:0;border-radius:9px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center;font-family:var(--site-font-display);font-weight:700;font-size:14px")}>{n}</span><span style={sx("font-size:15px;line-height:1.5;color:#0B1F3A")}>{text}</span></div>
    </div>
  );
}

export function Landing({ tab, setTab, drag, setDrag, onFile }: Props) {
  return (
    <>
      <section style={sx("position:relative;margin:8px;border-radius:24px;overflow:hidden;background:linear-gradient(168deg,#0B1F3A 0%,#0D2C3F 38%,#0E4A44 74%,#0E6B4F 118%);color:#F5F6F4")}>
        <div aria-hidden="true" style={sx("position:absolute;right:-20%;bottom:-40%;width:80%;height:90%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.30),rgba(63,145,116,0))")}></div>
        <header className="mt-wrap" style={sx("position:relative;height:76px;display:flex;align-items:center;justify-content:space-between;gap:12px")}>
          <div style={sx("display:flex;align-items:center;gap:12px;min-width:0")}>
            <img src="/brand/beta-mark-light.png" alt="Beta" style={sx("height:24px;width:auto;display:block")} />
            <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#F5F6F4")}>beta</span>
            <span style={sx("width:1px;height:20px;background:rgba(245,246,244,0.24)")}></span>
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5;white-space:nowrap")}>The Manager Test</span>
          </div>
          <a href="#how" className="mt-hover-light" style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:13px;font-weight:600;color:#C3CBD5;white-space:nowrap")}>How it works</a>
        </header>
        <div className="mt-wrap" style={sx("position:relative;padding-top:clamp(20px,5vw,64px);padding-bottom:clamp(28px,7vw,96px)")}>
          <div className="mt-hero">
            <div style={sx("display:flex;flex-direction:column;align-items:flex-start;min-width:0")}>
              <span style={sx("display:inline-flex;align-items:center;gap:10px;min-height:34px;padding:7px 14px;border-radius:999px;background:rgba(245,246,244,0.09);border:1px solid rgba(245,246,244,0.12);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(245,246,244,0.92)")}><span style={sx("width:7px;height:7px;border-radius:50%;background:#3F9174;box-shadow:0 0 0 4px rgba(63,145,116,0.25)")}></span>Free · Results in 60 seconds</span>
              <h1 style={sx("font-family:var(--site-font-display);font-size:clamp(36px,5.4vw,72px);font-weight:700;letter-spacing:-0.04em;line-height:1;color:#F5F6F4;margin:22px 0 0;text-wrap:balance")}>Are you ready to manage other people&apos;s money?</h1>
              <p style={sx("font-size:clamp(16px,1.5vw,19px);line-height:1.6;color:rgba(245,246,244,0.82);margin:18px 0 0;max-width:50ch;text-wrap:pretty")}>Upload your MT5 statement and get your Manager-Readiness score, judged the way an investor would judge you: risk and discipline first, returns last.</p>
            </div>

            <div style={sx("display:flex;flex-direction:column;gap:14px;min-width:0")}>
              <label
                data-testid="dropzone"
                onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
                style={{ ...sx("position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:clamp(28px,4vw,48px) 24px;border-radius:24px;background:#FAFAF8;cursor:pointer;box-shadow:0 30px 60px -24px rgba(0,0,0,0.5)"), border: `2px dashed ${drag ? "#0E6B4F" : "#B8C0CA"}` }}>
                <input type="file" accept=".xlsx,.html,.htm" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} style={sx("position:absolute;width:1px;height:1px;opacity:0")} />
                <span style={sx("width:60px;height:60px;border-radius:18px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M12 18v-6"></path><path d="m9 15 3-3 3 3"></path></svg></span>
                <span style={sx("font-family:var(--site-font-display);font-size:clamp(20px,2vw,24px);font-weight:700;letter-spacing:-0.02em;line-height:1.2;color:#0B1F3A")}>Drop your MT5 statement here</span>
                <span style={sx("font-size:14px;color:#6B7684")}>XLSX or HTML report · up to 10 MB</span>
                <span style={sx("margin-top:6px;display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 30px;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase")}>Choose file</span>
              </label>
              <p style={sx("display:flex;align-items:flex-start;gap:10px;margin:0;font-size:13px;line-height:1.5;color:rgba(245,246,244,0.78)")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9FDCBE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0;margin-top:1px")}><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>We don&apos;t store your statement. It&apos;s analyzed in memory and deleted right away.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="export" className="mt-wrap" style={sx("padding-top:clamp(56px,8vw,104px);padding-bottom:clamp(40px,6vw,72px)")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Export your statement</span>
        <h2 style={sx("font-family:var(--site-font-display);font-size:clamp(28px,3.6vw,44px);font-weight:700;letter-spacing:-0.035em;line-height:1.05;color:#0B1F3A;margin:14px 0 24px;text-wrap:balance")}>Four steps in MetaTrader 5.</h2>
        <div role="tablist" aria-label="Export instructions" style={sx("display:inline-flex;padding:4px;border-radius:999px;background:#FFFFFF;border:1px solid #DDE2E7;margin-bottom:24px")}>
          {([["desktop", "On desktop"], ["mobile", "On mobile"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ ...sx("min-height:44px;padding:0 20px;border:none;border-radius:999px;font-size:14px;font-weight:600;cursor:pointer"), background: tab === k ? "#0B1F3A" : "transparent", color: tab === k ? "#FFFFFF" : "#0B1F3A" }}>{label}</button>
          ))}
        </div>
        <div className="mt-steps">
          {(tab === "desktop" ? DESKTOP_STEPS : MOBILE_STEPS).map(([ph, text], i) => (
            <Step key={ph} n={i + 1} placeholder={ph} text={text} ratio="3 / 2" />
          ))}
        </div>
      </section>

      <section id="how" style={sx("background:#FFFFFF;border-top:1px solid #DDE2E7;border-bottom:1px solid #DDE2E7")}>
        <div className="mt-wrap" style={sx("padding-top:clamp(56px,8vw,104px);padding-bottom:clamp(56px,8vw,104px)")}>
          <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>How you&apos;re scored</span>
          <h2 style={sx("font-family:var(--site-font-display);font-size:clamp(28px,3.6vw,44px);font-weight:700;letter-spacing:-0.035em;line-height:1.05;color:#0B1F3A;margin:14px 0 28px;text-wrap:balance")}>Judged like a manager, not a gambler.</h2>
          <div className="mt-pillars">
            {PILLAR_WEIGHTS.map(([name, w]) => (
              <div key={name} style={sx("background:#FAFAF8;border:1px solid #DDE2E7;border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:14px")}>
                <span style={sx("font-family:var(--site-font-display);font-size:40px;font-weight:700;letter-spacing:-0.04em;line-height:1;color:#0B1F3A")}>{w}%</span>
                <div style={sx("height:6px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px"), width: `${w * 4}%` }}></div></div>
                <span style={sx("font-size:15px;font-weight:600;line-height:1.35;color:#0B1F3A")}>{name}</span>
              </div>
            ))}
          </div>
          <div style={sx("margin-top:16px;display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:16px;background:#F5EBD6")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A9781F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0;margin-top:2px")}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
            <span style={sx("font-size:15px;line-height:1.5;font-weight:500;color:#5C4210")}>Martingale, grid trading or a blown account caps your score, whatever the profit.</span>
          </div>

          <h3 style={sx("font-family:var(--site-font-display);font-size:clamp(22px,2.4vw,28px);font-weight:700;letter-spacing:-0.025em;color:#0B1F3A;margin:56px 0 20px")}>Four bands</h3>
          <div className="mt-bands">
            {BANDS.map((b, i) => {
              const top = i === 3;
              return (
                <div key={b.name} style={{ ...sx("border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:10px"), background: top ? "#0B1F3A" : "#FAFAF8", border: `1px solid ${top ? "#0B1F3A" : "#DDE2E7"}` }}>
                  <span style={{ ...sx("font-family:var(--site-font-display);font-size:15px;font-weight:700;letter-spacing:0.02em;font-variant-numeric:tabular-nums"), color: top ? "#9FDCBE" : "#0E6B4F" }}>{b.range}</span>
                  <span style={{ ...sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1.15"), color: top ? "#F5F6F4" : "#0B1F3A" }}>{b.name}</span>
                  <span style={{ ...sx("font-size:14px;line-height:1.5"), color: top ? "rgba(245,246,244,0.82)" : "#1C2430" }}>{b.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
