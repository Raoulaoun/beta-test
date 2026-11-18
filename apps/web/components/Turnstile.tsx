"use client";
import { useEffect, useRef } from "react";

// Invisible Cloudflare Turnstile. Renders nothing visible unless Cloudflare asks for a check.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local/staging) it does nothing.
declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void } }
}
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let cancelled = false;
    let widget: string | undefined;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, { sitekey: SITE_KEY, appearance: "interaction-only", callback: onToken, "refresh-expired": "auto" });
    };
    if (window.turnstile) render();
    else {
      let sc = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
      if (!sc) { sc = document.createElement("script"); sc.src = SRC; sc.async = true; document.head.appendChild(sc); }
      sc.addEventListener("load", render, { once: true });
    }
    // The form moves between the page and the modal: each view gets its own widget, and the
    // one that unmounts is removed so it never answers for a form that is not shown.
    return () => { cancelled = true; if (widget && window.turnstile) { try { window.turnstile.remove(widget); } catch { /* already gone */ } } };
  }, [onToken]);
  return SITE_KEY ? <div ref={box} /> : null;
}

export const turnstileEnabled = () => !!SITE_KEY;
