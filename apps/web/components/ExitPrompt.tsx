"use client";
import { sx } from "../lib/sx.ts";

// Exit prompt, from design/flow ("EXIT MODAL").
export function ExitPrompt({ onClose, onToForm }: { onClose: () => void; onToForm: () => void }) {
  return (
    <div data-testid="exit-prompt" onClick={onClose} style={sx("position:fixed;inset:0;z-index:50;background:rgba(11,31,58,0.62);display:flex;align-items:center;justify-content:center;padding:20px")}>
      <div role="dialog" aria-modal="true" aria-labelledby="mt-exit-t" onClick={(e) => e.stopPropagation()} style={sx("position:relative;width:100%;max-width:440px;background:#FFFFFF;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:14px;box-shadow:0 40px 80px -30px rgba(0,0,0,0.6)")}>
        <button type="button" aria-label="Close" onClick={onClose} style={sx("position:absolute;top:12px;right:12px;width:44px;height:44px;border:none;border-radius:50%;background:transparent;color:#6B7684;font-size:24px;line-height:1;cursor:pointer")}>×</button>
        <span style={sx("width:52px;height:52px;border-radius:16px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h5"></path></svg></span>
        <h2 id="mt-exit-t" style={sx("font-family:var(--site-font-display);font-size:26px;font-weight:700;letter-spacing:-0.025em;line-height:1.12;color:#0B1F3A;margin:4px 0 0;padding-right:28px")}>Get your improvement plan before you go.</h2>
        <p style={sx("margin:0;font-size:15px;line-height:1.55;color:#1C2430")}>Your top 3 fixes, sent to your email as a free PDF.</p>
        <button type="button" onClick={onToForm} style={sx("margin-top:8px;height:54px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>Send my full report</button>
        <button type="button" onClick={onClose} style={sx("min-height:44px;border:none;background:transparent;font-size:14px;font-weight:600;color:#6B7684;cursor:pointer")}>No thanks</button>
      </div>
    </div>
  );
}
