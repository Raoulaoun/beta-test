"use client";
import { useEffect, useRef, useState } from "react";
import { sx } from "../../lib/sx.ts";

// Account header (design/account): Dashboard / Settings on desktop, and the initials avatar
// opening a menu with the name, email, Dashboard, Settings and Sign out (both widths).

export const SignOutIcon = ({ size = 18, width = "2" }: { size?: number; width?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>
);

// Ends the session and forgets this browser, then shows "You're signed out".
export async function signOut(preview = false) {
  if (!preview) await fetch("/api/auth/signout", { method: "POST" }).catch(() => undefined);
  window.location.href = preview ? "/signin?signedout=1&preview=1" : "/signin?signedout=1";
}

type Props = { current: "dashboard" | "settings"; initials: string; name: string; email: string; preview?: boolean; openMenu?: boolean };

export function AccountMenu({ current, initials, name, email, preview = false, openMenu = false }: Props) {
  const [open, setOpen] = useState(openMenu);
  const wrap = useRef<HTMLDivElement>(null);
  const nav: [string, string, "dashboard" | "settings"][] = [["/dashboard", "Dashboard", "dashboard"], ["/settings", "Settings", "settings"]];
  const href = (h: string) => (preview ? `${h}?preview=1` : h);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); (wrap.current?.querySelector("button") as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <nav aria-label="Account" style={sx("display:flex;align-items:center;gap:4px")}>
      {nav.map(([h, label, key]) => (
        <a key={key} href={href(h)} className="ac-dsk" aria-current={current === key ? "page" : undefined} style={{ ...sx("min-height:44px;padding:0 14px;border:none;border-radius:999px;color:#0B1F3A;font-size:14px;font-weight:600;cursor:pointer;align-items:center"), background: current === key ? "#E7F1ED" : "transparent" }}>{label}</a>
      ))}
      <div ref={wrap} style={sx("position:relative;margin-left:6px")}>
        <button type="button" data-testid="account-menu-button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${name}`} style={sx("width:44px;height:44px;border:none;border-radius:50%;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center")}>
          <span style={sx(`width:36px;height:36px;border-radius:50%;background:#0B1F3A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:${open ? "0 0 0 3px rgba(14,107,79,0.25)" : "none"}`)}>{initials}</span>
        </button>
        {open && (
          <div role="menu" aria-label="Account" data-testid="account-menu" style={sx("position:absolute;top:calc(100% + 8px);right:0;z-index:30;width:min(280px,calc(100vw - 32px));padding:8px;border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;box-shadow:0 18px 40px rgba(11,31,58,0.16);display:flex;flex-direction:column")}>
            <div style={sx("display:flex;flex-direction:column;gap:2px;padding:10px 12px 12px;border-bottom:1px solid #EEF0F2;margin-bottom:6px")}>
              <span style={sx("font-size:15px;font-weight:700;color:#0B1F3A")}>{name}</span>
              <span style={sx("font-size:13px;color:#6B7684;overflow-wrap:anywhere")}>{email}</span>
            </div>
            {nav.map(([h, label, key]) => (
              <a key={key} role="menuitem" href={href(h)} style={{ ...sx("display:flex;align-items:center;min-height:44px;padding:0 12px;border:none;border-radius:10px;color:#0B1F3A;font-size:15px;font-weight:600;cursor:pointer;text-align:left"), background: current === key ? "#E7F1ED" : "transparent" }}>{label}</a>
            ))}
            <button type="button" role="menuitem" data-testid="menu-signout" onClick={() => signOut(preview)} style={sx("display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;margin-top:6px;border:none;border-top:1px solid #EEF0F2;border-radius:0 0 10px 10px;background:transparent;color:#0B1F3A;font-size:15px;font-weight:600;cursor:pointer;text-align:left")}><SignOutIcon />Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

// "You're signed out" (design/account, view=signedout).
export function SignedOut() {
  return (
    <section className="ac-wrap" style={sx("padding-top:clamp(40px,9vw,112px);padding-bottom:clamp(56px,9vw,120px);display:flex;justify-content:center")}>
      <div role="status" data-testid="signed-out" className="ac-pad" style={sx("width:100%;max-width:480px;background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px")}>
        <span aria-hidden="true" style={sx("width:56px;height:56px;border-radius:18px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><SignOutIcon size={26} width="1.8" /></span>
        <div style={sx("display:flex;flex-direction:column;gap:8px")}>
          <h1 style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(26px,3vw,32px);font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:#0B1F3A")}>You're signed out</h1>
          <p style={sx("margin:0;font-size:16px;line-height:1.55;color:#4C5A6E;text-wrap:pretty")}>Nothing about your account is left on this browser. Your history is safe. Sign in with a code any time.</p>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:10px")}>
          <a href="/" className="ac-hover-green" style={sx("display:flex;align-items:center;justify-content:center;height:56px;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase")}>Back to the Manager Test</a>
          <a href="/signin" style={sx("display:flex;align-items:center;justify-content:center;height:52px;border-radius:999px;border:1px solid #0B1F3A;background:#FFFFFF;color:#0B1F3A;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>Sign in again</a>
        </div>
      </div>
    </section>
  );
}
