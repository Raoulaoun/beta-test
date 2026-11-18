// Browser-only helpers: attribution, saved result (30 days), progress beacons.
"use client";

const ATTR_KEY = "mt_attr";
const SAVED_KEY = "mt_saved";
const VISIT_KEY = "mt_visit";
const EXIT_KEY = "mt_exit_shown";
export const SAVED_DAYS = 30;

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

// UTM tags and introducer ref from the landing URL, kept for the browser session.
export function captureAttribution(): string {
  return safe(() => {
    const q = new URLSearchParams(window.location.search);
    const keep = new URLSearchParams();
    for (const [k, v] of q) if (k.startsWith("utm_") || k === "ref") keep.set(k, v);
    if ([...keep.keys()].length) sessionStorage.setItem(ATTR_KEY, keep.toString());
    return sessionStorage.getItem(ATTR_KEY) || "";
  }, "");
}

export function sendEvent(kind: "visit" | "upload_started", attribution: string): void {
  if (kind === "visit") {
    if (safe(() => sessionStorage.getItem(VISIT_KEY), "1")) return;
    safe(() => sessionStorage.setItem(VISIT_KEY, "1"), undefined);
  }
  safe(() => navigator.sendBeacon?.("/api/events", new Blob([JSON.stringify({ kind, attribution })], { type: "application/json" })), false);
}

export type FormSource = "results_button" | "exit_prompt" | "coach_more" | "signed_out_banner";

// Lead form opened in the modal, and from which button.
export function formOpened(id: string | undefined, token: string | undefined, source: FormSource): void {
  if (!id || !token) return;
  safe(() => navigator.sendBeacon?.("/api/events", new Blob([JSON.stringify({ kind: "form_opened", source, result_id: id, token })], { type: "application/json" })), false);
}

export type Saved = { id: string; token: string; at: number };
export function saveForLater(id: string, token: string): void {
  safe(() => localStorage.setItem(SAVED_KEY, JSON.stringify({ id, token, at: Date.now() })), undefined);
}
export function loadSaved(): Saved | null {
  return safe(() => {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || "null") as Saved | null;
    if (!v || Date.now() - v.at > SAVED_DAYS * 86_400_000) { localStorage.removeItem(SAVED_KEY); return null; }
    return v;
  }, null);
}
export function forgetSaved(): void {
  safe(() => localStorage.removeItem(SAVED_KEY), undefined);
}

export function progress(id: string | undefined, token: string | undefined, step: "pillars" | "lead_form" | "exit_prompt"): void {
  if (!id || !token) return;
  safe(() => fetch(`/api/results/${id}/progress`, { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ token, step }) }), undefined);
}

export function exitPromptAllowed(): boolean {
  return safe(() => {
    if (sessionStorage.getItem(EXIT_KEY)) return false;
    sessionStorage.setItem(EXIT_KEY, "1");
    return true;
  }, false);
}
