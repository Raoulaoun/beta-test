"use client";
import { useState } from "react";
import { sx } from "../../lib/sx.ts";

// Admin sign-in, built from existing design pieces (admin sidebar brand, white card, lead-form
// inputs, primary button). Step 1: email + password. Step 2: authenticator code.
const input = "height:50px;padding:0 14px;border-radius:12px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:16px;color:#1C2430";
const fieldLabel = "display:flex;flex-direction:column;gap:7px;font-size:14px;font-weight:600;color:#0B1F3A";

export function AdminLogin() {
  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (step === "password") {
        const res = await post("/api/admin/login", { email, password });
        const body = await res.json().catch(() => ({}));
        if (res.ok) { setPending(body.pending); setStep("code"); return; }
        setError(res.status === 429 ? "Too many attempts. Try again in 15 minutes." : "Wrong email or password.");
      } else {
        const res = await post("/api/admin/code", { pending, code });
        if (res.ok) { window.location.href = "/admin"; return; }
        if (res.status === 429) setError("Too many attempts. Try again in 15 minutes.");
        else if (res.status === 401 && code.length === 6) setError("That code didn't work. Wait for the next one and try again.");
        else setError("Enter the 6-digit code from your authenticator app.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={sx("font-family:var(--site-font-body);min-height:100vh;background:#F3F4F2;display:flex;align-items:center;justify-content:center;padding:20px")}>
      <form onSubmit={submit} data-testid="admin-login" style={sx("width:100%;max-width:420px;background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;padding:32px;display:flex;flex-direction:column;gap:18px")}>
        <div style={sx("display:flex;flex-direction:column;gap:6px")}>
          <div style={sx("display:flex;align-items:center;gap:10px")}><img src="/brand/beta-mark-dark.png" alt="Beta" style={sx("height:22px;width:auto;display:block")} /><span style={sx("font-family:var(--site-font-display);font-size:20px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#0B1F3A")}>beta</span></div>
          <span style={sx("font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684")}>Manager Test · Admin</span>
        </div>
        <h1 style={sx("margin:0;font-family:var(--site-font-display);font-size:28px;font-weight:700;letter-spacing:-0.03em;color:#0B1F3A")}>{step === "password" ? "Sign in" : "Two-step check"}</h1>
        {step === "password" ? (
          <>
            <div style={sx(fieldLabel)}><label htmlFor="ad-email">Email</label><input id="ad-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required style={sx(input)} /></div>
            <div style={sx(fieldLabel)}><label htmlFor="ad-password">Password</label><input id="ad-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required style={sx(input)} /></div>
          </>
        ) : (
          <div style={sx(fieldLabel)}><label htmlFor="ad-code">Code from your authenticator app</label><input id="ad-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus style={sx(input + ";letter-spacing:0.3em;font-variant-numeric:tabular-nums")} /></div>
        )}
        {error && <span role="alert" style={sx("font-size:13px;color:#A23B2E")}>{error}</span>}
        <button type="submit" disabled={busy} style={{ ...sx("height:52px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer"), opacity: busy ? 0.8 : 1 }}>{step === "password" ? "Continue" : "Sign in"}</button>
      </form>
    </div>
  );
}
