"use client";
import { sx } from "../lib/sx.ts";
import { Tick } from "./Chrome.tsx";

// Signed-in results: shown where the lead form would be. Built from the design's
// "No red flags found" panel (approved: build from existing pieces).
export function SavedBanner() {
  return (
    <div data-testid="saved-banner" className="mt-a-form" style={sx("display:flex;align-items:center;gap:14px;padding:20px 22px;border-radius:20px;background:#E7F1ED;align-self:start")}>
      <span style={sx("width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Tick size={16} width="3" /></span>
      <span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A")}>Saved to your dashboard</span>
    </div>
  );
}
