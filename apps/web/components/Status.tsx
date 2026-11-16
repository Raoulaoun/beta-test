"use client";
import { sx } from "../lib/sx.ts";
import { errorCopy, isFileError } from "../lib/view.ts";
import type { ErrKey } from "../lib/types.ts";
import { FileIcon, Spinner, Tick } from "./Chrome.tsx";

const STEP_LABELS = ["Reading your trades…", "Checking risk…", "Scoring your discipline…"];

export function Analyzing({ fileName, step }: { fileName: string; step: number }) {
  return (
    <section className="mt-wrap" style={sx("padding-top:clamp(48px,10vw,120px);padding-bottom:clamp(64px,10vw,140px);display:flex;justify-content:center")}>
      <div role="status" aria-live="polite" data-testid="analyzing" className="mt-pad" style={sx("width:100%;max-width:520px;background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:24px")}>
        <div style={sx("display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:14px;background:#FAFAF8;border:1px solid #DDE2E7")}>
          <span style={sx("width:36px;height:36px;border-radius:10px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center;flex-shrink:0")}><FileIcon size={18} /></span>
          <span style={sx("font-size:15px;font-weight:600;color:#0B1F3A;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{fileName}</span>
        </div>
        <h1 style={sx("font-family:var(--site-font-display);font-size:clamp(26px,3vw,32px);font-weight:700;letter-spacing:-0.03em;line-height:1.1;color:#0B1F3A;margin:0")}>Scoring your record</h1>
        <div style={sx("height:6px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px;transition:width 0.6s ease"), width: Math.round((step / 3) * 100) + "%" }}></div></div>
        <div style={sx("display:flex;flex-direction:column;gap:4px")}>
          {STEP_LABELS.map((label, i) => (
            <div key={label} style={sx("display:flex;align-items:center;gap:14px;min-height:44px")}>
              <span style={sx("width:24px;height:24px;flex-shrink:0;display:flex;align-items:center;justify-content:center")}>
                {i < step && <span style={sx("width:24px;height:24px;border-radius:50%;background:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Tick size={13} width="3.2" /></span>}
                {i === step && <Spinner css="width:20px;height:20px;border-radius:50%;border:2.5px solid #E7F1ED;border-top-color:#0E6B4F;display:block" />}
                {i > step && <span style={sx("width:20px;height:20px;border-radius:50%;border:2px solid #DDE2E7;display:block")}></span>}
              </span>
              <span style={{ ...sx("font-size:16px"), fontWeight: i === step ? 600 : 500, color: i > step ? "#9AA5B3" : "#0B1F3A" }}>{label}</span>
            </div>
          ))}
        </div>
        <p style={sx("margin:0;font-size:13px;line-height:1.5;color:#6B7684")}>Your statement is analyzed in memory and deleted right away.</p>
      </div>
    </section>
  );
}

export function ErrorCard({ err, fileName, onFile, onExport }: { err: ErrKey; fileName: string; onFile: (f: File | undefined) => void; onExport: (e: React.MouseEvent) => void }) {
  const [title, body] = errorCopy(err);
  return (
    <section className="mt-wrap" style={sx("padding-top:clamp(48px,10vw,120px);padding-bottom:clamp(64px,10vw,140px);display:flex;justify-content:center")}>
      <div role="alert" data-testid="error" data-err={err} className="mt-pad" style={sx("width:100%;max-width:560px;background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;align-items:flex-start;gap:18px")}>
        <span style={sx("width:52px;height:52px;border-radius:16px;background:#F5EBD6;color:#A9781F;display:flex;align-items:center;justify-content:center")}><FileIcon size={24} extra={<><path d="M12 12v3"></path><path d="M12 18h.01"></path></>} /></span>
        <span style={sx("font-size:13px;font-weight:600;color:#6B7684;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{fileName}</span>
        <h1 style={sx("font-family:var(--site-font-display);font-size:clamp(24px,3vw,32px);font-weight:700;letter-spacing:-0.03em;line-height:1.12;color:#0B1F3A;margin:0;text-wrap:balance")}>{title}</h1>
        {body && <p style={sx("margin:0;font-size:16px;line-height:1.6;color:#1C2430;text-wrap:pretty")}>{body}</p>}
        <div style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;margin-top:6px;width:100%")}>
          <label style={sx("position:relative;display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 26px;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>Upload another file<input type="file" accept=".xlsx,.html,.htm" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} style={sx("position:absolute;width:1px;height:1px;opacity:0")} /></label>
          {isFileError(err) && <a href="#export" onClick={onExport} style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:600;color:#0E6B4F")}><span style={sx("border-bottom:1px solid rgba(14,107,79,0.4);padding-bottom:2px")}>See how to export from MT5</span></a>}
        </div>
      </div>
    </section>
  );
}
