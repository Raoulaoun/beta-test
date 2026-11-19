"use client";
import { useState } from "react";
import { sx } from "../lib/sx.ts";
import { errorCopy } from "../lib/view.ts";
import { Spinner } from "./Chrome.tsx";

// Signed out on a browser that has an account (known device). Built from the design's green
// panel and outlined button. The link goes to the account's email; this result is held for
// the account and joins the history when the link is used.
export const SIGNED_OUT_COPY = {
  line: "You already have a Manager Test account. Sign in to save this result to your history.",
  button: "Send me a sign-in link",
  // PLACEHOLDER until copy is supplied (docs/spec.md launch checklist).
  sent: "Sign-in link sent. Check your email.",
};

export function SignedOutBanner({ resultId, token }: { resultId?: string; token?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const send = async () => {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      const res = await fetch("/api/auth/request-known", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result_id: resultId, token }) });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  };
  return (
    <div data-testid="signed-out-banner" role="region" aria-label="Sign in" style={sx("margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:20px 22px;border-radius:20px;background:#E7F1ED")}>
      <span style={sx("flex:1 1 320px;font-size:16px;line-height:1.5;font-weight:600;color:#0B1F3A")}>{SIGNED_OUT_COPY.line}</span>
      {state === "sent"
        ? <span role="status" data-testid="signin-sent" style={sx("font-size:15px;font-weight:700;color:#0E6B4F")}>{SIGNED_OUT_COPY.sent}</span>
        : (
          <button type="button" onClick={send} disabled={state === "sending"} aria-busy={state === "sending"} style={sx("min-height:44px;padding:10px 20px;border-radius:999px;border:1px solid #0E6B4F;background:#FFFFFF;color:#0E6B4F;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:10px;white-space:nowrap")}>
            {state === "sending" && <Spinner css="width:14px;height:14px;border-radius:50%;border:2px solid rgba(14,107,79,0.3);border-top-color:#0E6B4F;display:inline-block" />}
            {SIGNED_OUT_COPY.button}
          </button>
        )}
      {state === "failed" && <span role="alert" style={sx("flex-basis:100%;font-size:13px;color:#A23B2E")}>{errorCopy("server").join(" ")}</span>}
    </div>
  );
}
