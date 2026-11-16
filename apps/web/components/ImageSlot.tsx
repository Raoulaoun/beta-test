import { sx } from "../lib/sx.ts";

// Empty-state of the design's <image-slot> (which renders at 3:2 whatever ratio the
// markup asks for): a placeholder until the real export
// screenshots arrive (launch blocker in docs/spec.md).
export function ImageSlot({ placeholder, ratio }: { placeholder: string; ratio: string }) {
  return (
    <div role="img" aria-label={placeholder} style={{ ...sx("position:relative;width:100%;display:block;font:13px/1.3 system-ui,-apple-system,sans-serif"), aspectRatio: ratio }}>
      <div style={sx("position:absolute;inset:0;overflow:hidden;background:rgba(127,127,127,.08);border-radius:12px")}></div>
      <div style={sx("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box")}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={sx("opacity:.45")}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        <span style={sx("max-width:90%;font-weight:500;letter-spacing:.01em;opacity:.75")}>{placeholder}</span>
      </div>
      <div style={sx("position:absolute;inset:0;pointer-events:none;border:1.5px dashed currentColor;opacity:.35;border-radius:12px")}></div>
    </div>
  );
}
