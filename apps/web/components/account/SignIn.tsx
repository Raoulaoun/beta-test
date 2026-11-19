"use client";
import { useState } from "react";
import { sx } from "../../lib/sx.ts";

// Sign in, check your email, link expired (design/account). The request always shows
// "Check your email": the server never says whether an email has an account.
type View = "signin" | "check" | "expired";
const AUTH: Record<View, [string, string, string]> = {
  signin: ["Sign in to The Manager Test", "Enter the email you used for your report. We'll send you a sign-in link.", "Send sign-in link"],
  check: ["Check your email", "We sent you a sign-in link.", ""],
  expired: ["This sign-in link has expired", "Links work once, for 15 minutes. Enter your email and we'll send you a new one.", "Send a new link"],
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function request(email: string) {
  await fetch("/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) }).catch(() => null);
}

export function SignIn({ initial = "signin" }: { initial?: View }) {
  const [view, setView] = useState<View>(initial);
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, body, cta] = AUTH[view];
  const expired = view === "expired";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) { setEmailErr("Please enter a valid email"); return; }
    setBusy(true);
    await request(email);
    setBusy(false);
    setResent(false);
    setView("check");
  };
  const resend = async () => { await request(email); setResent(true); };

  return (
    <section className="ac-wrap" style={sx("padding-top:clamp(40px,9vw,112px);padding-bottom:clamp(56px,9vw,120px);display:flex;justify-content:center")}>
      <div className="ac-pad" data-testid={`auth-${view}`} style={sx("width:100%;max-width:480px;background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px")}>
        <span style={{ ...sx("width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center"), background: expired ? "#F5EBD6" : "#E7F1ED", color: expired ? "#7A5A16" : "#0E6B4F" }}>
          {expired
            ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
            : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>}
        </span>
        <div style={sx("display:flex;flex-direction:column;gap:8px")}>
          <h1 style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(28px,3vw,34px);font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:#0B1F3A")}>{title}</h1>
          <p style={sx("margin:0;font-size:16px;line-height:1.55;color:#4C5A6E;text-wrap:pretty")}>{body}</p>
        </div>
        {(view === "signin" || view === "expired") && (
          <form onSubmit={send} noValidate style={sx("display:flex;flex-direction:column;gap:14px")}>
            <div style={sx("display:flex;flex-direction:column;gap:7px")}>
              <label htmlFor="ac-email" style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Email</label>
              <input id="ac-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }} aria-invalid={!!emailErr}
                style={{ ...sx("height:52px;padding:0 14px;border-radius:12px;background:#FFFFFF;font-size:16px;color:#1C2430"), border: `1px solid ${emailErr ? "#A23B2E" : "#DDE2E7"}` }} />
              {emailErr && <span role="alert" style={sx("font-size:13px;color:#A23B2E")}>{emailErr}</span>}
            </div>
            <button type="submit" disabled={busy} style={sx("height:56px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>{cta}</button>
            <span style={sx("font-size:13px;line-height:1.5;color:#6B7684")}>No password needed. We'll email you a link that signs you in.</span>
          </form>
        )}
        {view === "check" && (
          <div style={sx("display:flex;flex-direction:column;gap:12px;padding-top:4px")}>
            <div style={sx("padding:14px 16px;border-radius:14px;background:#E7F1ED;font-size:15px;line-height:1.5;color:#0B1F3A")}>Sent to <strong>{email.trim()}</strong>. The link works once, for 15 minutes.</div>
            <button type="button" onClick={resend} style={sx("height:52px;border-radius:999px;border:1px solid #0B1F3A;background:#FFFFFF;color:#0B1F3A;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>{resent ? "Link sent again" : "Resend link"}</button>
            <button type="button" onClick={() => setView("signin")} style={sx("align-self:flex-start;min-height:44px;border:none;background:transparent;padding:0;font-size:15px;font-weight:600;color:#0E6B4F;cursor:pointer")}>Use a different email</button>
          </div>
        )}
      </div>
    </section>
  );
}
