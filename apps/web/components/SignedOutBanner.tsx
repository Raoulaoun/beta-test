"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sx } from "../lib/sx.ts";
import { SignIn } from "./account/SignIn.tsx";

// Results screen, design/flow:
// - signed out on a browser that has an account (known device): the navy-wash banner with
//   "Sign in with a code" (opens the sign-in dialog: a bottom sheet on phones, a 520px dialog
//   on desktop) and a dismiss button. The right code adds this result to the history.
// - signed in: "You're signed in. This result is saved to your history." + Open my dashboard.
export const SIGNED_OUT_COPY = {
  line: "You already have a Manager Test account. Sign in to save this result to your history.",
  button: "Sign in with a code",
  dialogTitle: "Sign in to save this result",
};
export const SAVED_COPY = { line: "You're signed in. This result is saved to your history.", link: "Open my dashboard" };

const X = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
);

export function SignedOutBanner({ resultId, token, onSignedIn }: { resultId?: string; token?: string; onSignedIn: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (hidden) return null;
  return (
    <>
      <div role="note" data-testid="signed-out-banner" style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px 12px 14px 18px;margin-bottom:16px;border-radius:16px;background:#E6ECF5;border:1px solid rgba(11,31,58,0.14)")}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B1F3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0")}><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>
        <span style={sx("flex:1;min-width:220px;font-size:15px;line-height:1.5;color:#0B1F3A")}>{SIGNED_OUT_COPY.line}</span>
        <div style={sx("display:flex;align-items:center;gap:4px")}>
          <button ref={opener} type="button" data-testid="banner-signin" onClick={() => setOpen(true)} style={sx("display:inline-flex;align-items:center;height:44px;padding:0 20px;border:none;border-radius:999px;background:#0B1F3A;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer;white-space:nowrap")}>{SIGNED_OUT_COPY.button}</button>
          <button type="button" aria-label="Dismiss" onClick={() => setHidden(true)} style={sx("width:44px;height:44px;border:none;border-radius:50%;background:transparent;color:#4C5A6E;cursor:pointer;display:flex;align-items:center;justify-content:center")}><X /></button>
        </div>
      </div>
      {open && (
        <SignInDialog returnTo={opener} onClose={() => setOpen(false)}>
          <SignIn embedded title={SIGNED_OUT_COPY.dialogTitle} attach={resultId && token ? { result_id: resultId, token } : undefined}
            onDone={() => { setOpen(false); window.dispatchEvent(new Event("mt:signed-in")); onSignedIn(); }} />
        </SignInDialog>
      )}
    </>
  );
}

export function SavedBanner() {
  return (
    <div role="status" data-testid="saved-banner" style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:14px 18px;margin-bottom:16px;border-radius:16px;background:#E7F1ED;border:1px solid rgba(14,107,79,0.25)")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0E6B4F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0")}><path d="M20 6 9 17l-5-5"></path></svg>
      <span style={sx("flex:1;min-width:220px;font-size:15px;line-height:1.5;color:#0B3D2E")}>{SAVED_COPY.line}</span>
      <a href="/dashboard" style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:700;color:#0E6B4F;text-decoration:underline;text-underline-offset:3px")}>{SAVED_COPY.link}</a>
    </div>
  );
}

// The dialog: backdrop click, X and Esc close it; focus is trapped inside (the page behind
// is inert) and returns to the banner button.
function SignInDialog({ onClose, returnTo, children }: { onClose: () => void; returnTo: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-modal-host", "");
    document.body.appendChild(el);
    const others = Array.from(document.body.children).filter((c) => c !== el && !c.hasAttribute("inert")) as HTMLElement[];
    others.forEach((c) => c.setAttribute("inert", ""));
    const html = document.documentElement, overflow = html.style.overflow;
    html.style.overflow = "hidden";
    setHost(el);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close.current(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); others.forEach((c) => c.removeAttribute("inert")); html.style.overflow = overflow; el.remove();
      const back = returnTo.current; if (back?.isConnected) back.focus({ preventScroll: true }); };
  }, [returnTo]);
  useEffect(() => { if (host) setTimeout(() => (document.getElementById("si-email") ?? panel.current)?.focus(), 30); }, [host]);
  if (!host) return null;
  return createPortal(
    <>
      <div className="mt-si-back" onClick={() => close.current()}></div>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="si-title" className="mt-si" data-testid="signin-dialog" tabIndex={-1}>
        <button type="button" aria-label="Close" onClick={() => close.current()} style={sx("position:absolute;top:12px;right:12px;z-index:1;width:44px;height:44px;border:none;border-radius:50%;background:#F3F4F2;color:#0B1F3A;cursor:pointer;display:flex;align-items:center;justify-content:center")}><X /></button>
        {children}
      </div>
    </>,
    host,
  );
}
