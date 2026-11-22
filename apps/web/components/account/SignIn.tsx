"use client";
import { useEffect, useRef, useState } from "react";
import { sx } from "../../lib/sx.ts";

// Sign in with a 6-digit code: the design's "Manager Test Sign In" component (design/account,
// view=signin; and embedded in the results screen's sign-in dialog). Copy word for word from
// docs/advice-texts.md ("Sign in with a code").
//
// Step 1, email → POST /api/auth/code. Step 2, six boxes over one hidden input
// (autocomplete one-time-code, numeric keypad, paste), a full code submits itself →
// POST /api/auth/code/verify. Unknown emails get the same answers as wrong codes.

export const SIGN_IN_COPY = {
  title: "Sign in to The Manager Test",
  body: "Enter the email you used for your report. We'll send you a code to sign in.",
  noPassword: "No password needed. We'll email you a 6-digit code.",
  invalidEmail: "Enter a full email address, like name@example.com.",
  codeTitle: "Enter your code",
  codeBody: "We sent a 6-digit code to ",
  helper: "It works for 10 minutes. Not there? Check your spam folder.",
  wrong: (n: number) => `That code isn't right. Check the email and try again. ${n} ${n === 1 ? "try" : "tries"} left.`,
  expired: "This code has expired. Codes work for 10 minutes. Send a new one to continue.",
  locked: "Too many wrong tries, so this code has stopped working. Send a new one to continue.",
  ratelimit: (m: number) => `You've asked for 5 codes in the last hour. Try again in ${m} ${m === 1 ? "minute" : "minutes"}, or use the newest code you already have.`,
  resent: "Code sent again. Use the newest one.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Status = "idle" | "wrong" | "expired" | "locked" | "ratelimit" | "resent" | "checking" | "failed";

const ICONS = {
  alert: "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  tick: "M20 6 9 17l-5-5",
};

function Spinner() {
  return <span aria-hidden="true" style={sx("width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#FFFFFF;animation:sispin 0.8s linear infinite;display:inline-block")}></span>;
}

type Props = {
  embedded?: boolean;
  title?: string;
  // The result on screen (results banner): added to the history when the code is right.
  attach?: { result_id: string; token: string };
  onDone?: () => void;
};

export function SignIn({ embedded = false, title, attach, onDone }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [tries, setTries] = useState(5);
  const [wait, setWait] = useState(60);
  const [focused, setFocused] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => { if (step === "code") setTimeout(() => codeRef.current?.focus(), 30); }, [step]);

  const request = async (): Promise<"sent" | "ratelimit" | "failed"> => {
    try {
      const res = await fetch("/api/auth/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      if (res.ok) return "sent";
      if (res.status === 429) { const b = await res.json().catch(() => ({})); setWait(Number(b.minutes) || 60); return "ratelimit"; }
      return "failed";
    } catch { return "failed"; }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!EMAIL_RE.test(email.trim())) { setEmailErr(SIGN_IN_COPY.invalidEmail); emailRef.current?.focus(); return; }
    setSending(true);
    const out = await request();
    setSending(false);
    if (out === "failed") { setEmailErr("Something went wrong on our side. Please try again in a minute."); return; }
    setCode(""); setTries(5); setStatus(out === "ratelimit" ? "ratelimit" : "idle"); setStep("code");
  };

  const resend = async () => {
    if (status === "checking") return;
    setCode("");
    const out = await request();
    if (out === "sent") { setTries(5); setStatus("resent"); }
    else setStatus(out === "ratelimit" ? "ratelimit" : "failed");
    codeRef.current?.focus();
  };

  const verify = async (value = code) => {
    if (busy.current || status === "expired" || status === "locked") return;
    if (value.length < 6) { setStatus("wrong"); return; }
    busy.current = true;
    setStatus("checking");
    try {
      const res = await fetch("/api/auth/code/verify", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: value, ...(attach ?? {}) }) });
      if (res.ok) {
        setStatus("idle");
        if (onDone) onDone(); else window.location.href = "/dashboard";
        return;
      }
      const b = await res.json().catch(() => ({}));
      if (b.error === "wrong") { setTries(Number(b.tries_left) || 1); setStatus("wrong"); setCode(""); }
      else if (b.error === "expired" || b.error === "locked") { setStatus(b.error); setCode(""); if (b.error === "locked") setTries(0); }
      else setStatus("failed");
      setTimeout(() => codeRef.current?.focus(), 30);
    } catch {
      setStatus("failed");
    } finally {
      busy.current = false;
    }
  };

  const dead = status === "expired" || status === "locked";
  const err = status === "wrong" || dead;
  const checking = status === "checking";
  const msg: [string, "alert" | "status", string, string, string] | null = {
    wrong: [SIGN_IN_COPY.wrong(tries), "alert", "#F5E4E1", "#7A2A20", ICONS.alert],
    expired: [SIGN_IN_COPY.expired, "alert", "#F5EBD6", "#3D2C0B", ICONS.clock],
    locked: [SIGN_IN_COPY.locked, "alert", "#F5E4E1", "#7A2A20", ICONS.lock],
    ratelimit: [SIGN_IN_COPY.ratelimit(wait), "alert", "#F5EBD6", "#3D2C0B", ICONS.alert],
    resent: [SIGN_IN_COPY.resent, "status", "#E7F1ED", "#0B3D2E", ICONS.tick],
    failed: ["Something went wrong on our side. Please try again in a minute.", "alert", "#F5E4E1", "#7A2A20", ICONS.alert],
  }[status as string] as never ?? null;
  const digits = code.split("");
  const activeIx = Math.min(digits.length, 5);
  const isCode = step === "code";

  const onCode = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(v);
    if (!dead) setStatus(status === "ratelimit" || status === "resent" ? status : "idle");
    if (v.length === 6 && !dead) verify(v);
  };

  return (
    <div data-testid="signin" data-step={step} data-status={status} style={sx(`font-family:var(--site-font-body);color:#1C2430;width:100%;background:#FFFFFF;border:${embedded ? "none" : "1px solid #DDE2E7"};border-radius:24px;padding:${embedded ? "0" : "clamp(22px,3vw,32px)"};display:flex;flex-direction:column;gap:18px;box-sizing:border-box`)}>
      <span aria-hidden="true" style={sx(`width:56px;height:56px;border-radius:18px;background:${isCode ? "#E6ECF5" : "#E7F1ED"};color:${isCode ? "#0B1F3A" : "#0E6B4F"};display:flex;align-items:center;justify-content:center`)}>
        {isCode
          ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><path d="M12 14.5v2.5"></path></svg>
          : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>}
      </span>
      <div style={sx("display:flex;flex-direction:column;gap:8px")}>
        <h1 id="si-title" style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(26px,3vw,32px);font-weight:700;letter-spacing:-0.035em;line-height:1.08;color:#0B1F3A")}>{isCode ? SIGN_IN_COPY.codeTitle : (title || SIGN_IN_COPY.title)}</h1>
        <p style={sx("margin:0;font-size:16px;line-height:1.55;color:#4C5A6E;text-wrap:pretty")}>
          {isCode ? <>{SIGN_IN_COPY.codeBody}<strong style={sx("font-weight:700;color:#0B1F3A;overflow-wrap:anywhere")}>{email.trim()}</strong>.</> : SIGN_IN_COPY.body}
        </p>
      </div>

      {!isCode && (
        <form onSubmit={sendCode} noValidate style={sx("display:flex;flex-direction:column;gap:14px")}>
          <div style={sx("display:flex;flex-direction:column;gap:7px")}>
            <label htmlFor="si-email" style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Email</label>
            <input ref={emailRef} id="si-email" className="si-input" type="email" autoComplete="email" inputMode="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailErr(""); }} aria-invalid={!!emailErr} aria-describedby={emailErr ? "si-email-err" : undefined}
              style={sx(`height:52px;padding:0 14px;border-radius:12px;border:1px solid ${emailErr ? "#A23B2E" : "#DDE2E7"};background:#FFFFFF;font-size:16px;color:#1C2430;outline:none`)} />
            {emailErr && <span id="si-email-err" role="alert" style={sx("font-size:14px;line-height:1.45;color:#A23B2E")}>{emailErr}</span>}
          </div>
          <button type="submit" aria-busy={sending} style={sx("height:56px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px")}>{sending && <Spinner />}{sending ? "Sending" : "Send code"}</button>
          <span style={sx("font-size:13px;line-height:1.5;color:#6B7684")}>{SIGN_IN_COPY.noPassword}</span>
        </form>
      )}

      {isCode && (
        <form onSubmit={(e) => { e.preventDefault(); if (dead) resend(); else verify(); }} noValidate style={sx("display:flex;flex-direction:column;gap:14px")}>
          <div style={sx("display:flex;flex-direction:column;gap:8px")}>
            <label htmlFor="si-code" style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>6-digit code</label>
            <div style={sx(`position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;opacity:${dead ? "0.6" : "1"}`)}>
              {Array.from({ length: 6 }, (_, i) => {
                const filled = i < digits.length, active = focused && !dead && !checking && i === activeIx;
                return (
                  <span key={i} aria-hidden="true" data-testid="code-box" style={sx(`height:60px;border-radius:12px;border:${err && !dead ? "1.5px solid #A23B2E" : active ? "1.5px solid #0E6B4F" : filled ? "1.5px solid #8A94A3" : "1px solid #DDE2E7"};background:${dead ? "#F3F4F2" : "#FFFFFF"};box-shadow:${active ? "0 0 0 3px rgba(14,107,79,0.18)" : "none"};display:flex;align-items:center;justify-content:center;font-family:var(--site-font-display);font-size:26px;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums`)}>
                    {digits[i] ?? ""}{active && !filled && <span style={sx("width:2px;height:28px;background:#0E6B4F;animation:sicaret 1s step-end infinite")}></span>}
                  </span>
                );
              })}
              <input ref={codeRef} id="si-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
                value={code} onChange={onCode} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} disabled={dead || checking}
                aria-invalid={err} aria-describedby="si-code-msg"
                style={sx("position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;background:transparent;font-size:16px;color:transparent;caret-color:transparent;cursor:text")} />
            </div>
            {msg
              ? (
                <div id="si-code-msg" role={msg[1]} data-testid="signin-msg" style={sx(`display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:${msg[2]};font-size:14px;line-height:1.5;color:${msg[3]}`)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0;margin-top:1px")}><path d={msg[4]}></path></svg>
                  <span>{msg[0]}</span>
                </div>
              )
              : <span id="si-code-msg" style={sx("font-size:13px;line-height:1.5;color:#6B7684")}>{SIGN_IN_COPY.helper}</span>}
          </div>
          <button type="submit" aria-busy={checking} disabled={checking} style={sx("height:56px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px")}>{checking && <Spinner />}{dead ? "Send a new code" : checking ? "Checking" : "Sign in"}</button>
          <div style={sx("display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px")}>
            <button type="button" onClick={resend} disabled={status === "ratelimit" || checking} style={sx(`min-height:44px;border:none;background:transparent;padding:0;font-size:15px;font-weight:600;color:${status === "ratelimit" ? "#8A94A3" : "#0E6B4F"};cursor:pointer`)}>Resend code</button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); setStatus("idle"); setTimeout(() => emailRef.current?.focus(), 30); }} style={sx("min-height:44px;border:none;background:transparent;padding:0;font-size:15px;font-weight:600;color:#0E6B4F;cursor:pointer")}>Use a different email</button>
          </div>
        </form>
      )}
    </div>
  );
}
