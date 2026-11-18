"use client";
import { useState } from "react";
import { sx } from "../lib/sx.ts";
import { useCallback } from "react";
import { COPY, errorCopy } from "../lib/view.ts";
import { progress } from "../lib/client.ts";
import { Spinner, Tick } from "./Chrome.tsx";
import { Turnstile } from "./Turnstile.tsx";

// Lead form, built and validated exactly as in design/flow, sent to /api/leads.
// One state (useLeadForm), two views: the inline card beside the score and the same form
// in the modal. Whatever is typed in one shows in the other; closing the modal keeps it.

export type FormState = { name: string; email: string; cc: string; phone: string; manage: string; consent: boolean; updates: boolean; remind: boolean };
type Errors = Partial<Record<"name" | "email" | "phone" | "manage" | "consent", string>>;

const BENEFITS = ["Every metric behind your score", "Your top 3 fixes, step by step", "How professional managers compare", "Your shareable score card"];
const COUNTRIES: [string, string][] = [["+961", "LB +961"], ["+971", "AE +971"], ["+966", "SA +966"], ["+974", "QA +974"], ["+965", "KW +965"], ["+962", "JO +962"], ["+20", "EG +20"], ["+33", "FR +33"], ["+44", "GB +44"], ["+1", "US +1"]];
const MANAGE = ["No", "Yes, friends and family", "Yes, formally"];

export function validate(v: Pick<FormState, "name" | "email" | "phone" | "manage" | "consent">): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = "Please enter your full name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) e.email = "Please enter a valid email";
  if (v.phone.replace(/\D/g, "").length < 6) e.phone = "Please enter a valid WhatsApp number";
  if (!v.manage) e.manage = "Please choose an option";
  if (!v.consent) e.consent = "Please tick this box so we can send your report";
  return e;
}

const errCss = "font-size:13px;color:#A23B2E";
const inputCss = "height:50px;padding:0 14px;border-radius:12px;background:#FFFFFF;font-size:16px;color:#1C2430";

const MESSAGES: Record<keyof Errors, string> = {
  name: "Please enter your full name", email: "Please enter a valid email",
  phone: "Please enter a valid WhatsApp number", manage: "Please choose an option",
  consent: "Please tick this box so we can send your report",
};

type Options = {
  retestDefault: boolean; initial?: Partial<FormState>; showErrors?: boolean;
  resultId?: string; token?: string; onSent?: (email: string) => void;
};

export type LeadFormState = ReturnType<typeof useLeadForm>;

export function useLeadForm({ retestDefault, initial, showErrors, resultId, token, onSent }: Options) {
  const [s, setS] = useState<FormState>({ name: "", email: "", cc: "+961", phone: "", manage: "", consent: false, updates: false, remind: retestDefault, ...initial });
  const [errors, setErrors] = useState<Errors>(() => (showErrors ? validate({ ...{ name: "", email: "", phone: "", manage: "", consent: false }, ...initial }) : {}));
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [turnstile, setTurnstile] = useState<string>("");
  const onToken = useCallback((t: string) => setTurnstile(t), []);
  const [touched, setTouched] = useState(false);
  const touch = () => { if (!touched) { setTouched(true); progress(resultId, token, "lead_form"); } };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setS((p) => ({ ...p, [k]: v }));
    if (k in errors) setErrors((e) => { const n = { ...e }; delete n[k as keyof Errors]; return n; });
  };
  // idp: the id prefix of the view that was submitted, so focus stays in that view.
  const focusFirst = (e: Errors, idp: string) => {
    const first = (["name", "email", "phone"] as const).find((k) => e[k]);
    if (first) document.getElementById(idp + first)?.focus();
  };

  const submit = async (ev: React.FormEvent, idp: string) => {
    ev.preventDefault();
    if (submitting) return;
    const e = validate(s);
    setErrors(e);
    setFailed(false);
    if (Object.keys(e).length) return focusFirst(e, idp);
    if (!resultId || !token) return setFailed(true);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ result_id: resultId, token, name: s.name, email: s.email, cc: s.cc, phone: s.phone,
          manage: s.manage, consent: s.consent, updates: s.updates, remind: s.remind, turnstile }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return onSent?.(body.sent_to || s.email.trim());
      if (res.status === 422 && Array.isArray(body.fields)) {
        const server: Errors = {};
        for (const f of body.fields as (keyof Errors)[]) if (f in MESSAGES) server[f] = MESSAGES[f];
        setErrors(server);
        return focusFirst(server, idp);
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return { s, set, errors, submitting, failed, submit, touch, onToken };
}

type ViewProps = { form: LeadFormState; idp: string; variant: "inline" | "modal"; turnstile: boolean };

export function LeadForm({ form, idp, variant, turnstile }: ViewProps) {
  const { s, set, errors, submitting, failed, submit, touch, onToken } = form;
  const border = (k: keyof Errors) => (errors[k] ? "#A23B2E" : "#DDE2E7");
  const chk = (on: boolean, label: string, toggle: () => void, isErr: boolean) => ({ on, label, toggle, isErr });
  const checks = [
    chk(s.remind, COPY.retest, () => set("remind", !s.remind), false),
    chk(s.consent, "Beta may contact me about my report by email or WhatsApp.", () => set("consent", !s.consent), !!errors.consent),
    chk(s.updates, "Send me occasional updates from Beta.", () => set("updates", !s.updates), false),
  ];

  return (
    <form id={variant === "inline" ? "report" : undefined} onSubmit={(e) => submit(e, idp)} onFocus={touch} noValidate
      data-testid={variant === "inline" ? "lead-form" : "lead-form-modal"}
      className={variant === "inline" ? "mt-a-form mt-pad" : undefined}
      style={sx(variant === "inline"
        ? "background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px;min-width:0;scroll-margin-top:16px"
        : "display:flex;flex-direction:column;gap:18px;min-width:0")}>
      <div style={sx("display:flex;flex-direction:column;gap:6px")}>
        <h2 id={idp + "title"} style={{ ...sx("font-family:var(--site-font-display);font-size:clamp(22px,2.4vw,28px);font-weight:700;letter-spacing:-0.025em;line-height:1.12;color:#0B1F3A;margin:0;text-wrap:balance"), ...(variant === "modal" ? { paddingRight: 44 } : {}) }}>Get your full report and improvement plan</h2>
        <p style={sx("margin:0;font-size:15px;color:#6B7684")}>Free PDF, sent to your email in a minute.</p>
      </div>
      <ul style={sx("list-style:none;margin:0;padding:14px 16px;border-radius:16px;background:#E7F1ED;display:flex;flex-direction:column;gap:8px")}>
        {BENEFITS.map((b) => (
          <li key={b} style={sx("display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.45;font-weight:500;color:#0B1F3A")}><Tick size={16} width="2.6" color="#0E6B4F" style={sx("flex-shrink:0;margin-top:2px")} />{b}</li>
        ))}
      </ul>

      <div style={sx("display:flex;flex-direction:column;gap:7px")}>
        <label htmlFor={idp + "name"} style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Full name</label>
        <input id={idp + "name"} type="text" autoComplete="name" value={s.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} style={{ ...sx(inputCss), border: `1px solid ${border("name")}` }} />
        {errors.name && <span role="alert" style={sx(errCss)}>{errors.name}</span>}
      </div>
      <div style={sx("display:flex;flex-direction:column;gap:7px")}>
        <label htmlFor={idp + "email"} style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Email</label>
        <input id={idp + "email"} type="email" autoComplete="email" inputMode="email" value={s.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} style={{ ...sx(inputCss), border: `1px solid ${border("email")}` }} />
        {errors.email && <span role="alert" style={sx(errCss)}>{errors.email}</span>}
      </div>
      <div style={sx("display:flex;flex-direction:column;gap:7px")}>
        <label htmlFor={idp + "phone"} style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Phone (WhatsApp)</label>
        <div style={sx("display:flex;gap:8px")}>
          <select aria-label="Country code" value={s.cc} onChange={(e) => set("cc", e.target.value)} style={sx("height:50px;width:112px;flex-shrink:0;padding:0 10px;border-radius:12px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:15px;font-weight:600;color:#0B1F3A")}>
            {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input id={idp + "phone"} type="tel" autoComplete="tel-national" inputMode="tel" placeholder="3 123 456" value={s.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} style={{ ...sx("height:50px;min-width:0;flex:1;padding:0 14px;border-radius:12px;background:#FFFFFF;font-size:16px;color:#1C2430"), border: `1px solid ${border("phone")}` }} />
        </div>
        {errors.phone && <span role="alert" style={sx(errCss)}>{errors.phone}</span>}
      </div>
      <div style={sx("display:flex;flex-direction:column;gap:9px")}>
        <span id={idp + "manage-l"} style={sx("font-size:14px;font-weight:600;color:#0B1F3A")}>Are you already managing money for others?</span>
        <div role="radiogroup" aria-labelledby={idp + "manage-l"} style={sx("display:flex;flex-wrap:wrap;gap:8px")}>
          {MANAGE.map((label) => {
            const on = s.manage === label;
            return <button key={label} type="button" role="radio" aria-checked={on} onClick={() => set("manage", label)} style={{ ...sx("min-height:44px;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap"), border: `1px solid ${on ? "#0E6B4F" : errors.manage ? "#A23B2E" : "#DDE2E7"}`, background: on ? "#E7F1ED" : "#FFFFFF", color: on ? "#0E6B4F" : "#0B1F3A" }}>{label}</button>;
          })}
        </div>
        {errors.manage && <span role="alert" style={sx(errCss)}>{errors.manage}</span>}
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:4px")}>
        {checks.map((c) => (
          <label key={c.label} style={sx("position:relative;display:flex;align-items:flex-start;gap:12px;cursor:pointer;min-height:44px;padding-top:4px")}>
            <input type="checkbox" checked={c.on} onChange={c.toggle} style={sx("position:absolute;opacity:0;width:1px;height:1px")} />
            <span style={{ ...sx("width:22px;height:22px;flex-shrink:0;border-radius:6px;display:flex;align-items:center;justify-content:center"), border: `1.5px solid ${c.on ? "#0E6B4F" : c.isErr ? "#A23B2E" : "#B8C0CA"}`, background: c.on ? "#0E6B4F" : "#FFFFFF" }}><Tick size={13} width="3.2" style={{ opacity: c.on ? 1 : 0 }} /></span>
            <span style={sx("font-size:14px;line-height:1.5;color:#1C2430")}>{c.label}</span>
          </label>
        ))}
        {errors.consent && <span role="alert" style={sx("font-size:13px;color:#A23B2E;padding-left:34px")}>{errors.consent}</span>}
      </div>

      {turnstile && <Turnstile onToken={onToken} />}
      {failed && <span role="alert" data-testid="lead-failed" style={sx(errCss)}>{errorCopy("server").join(" ")}</span>}
      <button type="submit" disabled={submitting} aria-busy={submitting} style={{ ...sx("height:56px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px"), opacity: submitting ? 0.8 : 1 }}>
        {submitting && <Spinner css="width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);border-top-color:#FFFFFF;display:inline-block" />}
        Send my full report
      </button>
    </form>
  );
}
