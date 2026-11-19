"use client";
import { useState } from "react";
import { sx } from "../../lib/sx.ts";
import { errorCopy } from "../../lib/view.ts";

// Settings (design/account, view=settings). The email is shown but can't be changed in v1.
export type SettingsData = { email: string; name: string; cc: string; phone: string; retest_reminders: boolean; updates: boolean; monthly_checkup: boolean; retest_days: number };

const COUNTRIES: [string, string][] = [["+961", "LB +961"], ["+971", "AE +971"], ["+966", "SA +966"], ["+974", "QA +974"], ["+965", "KW +965"], ["+962", "JO +962"], ["+20", "EG +20"], ["+33", "FR +33"], ["+44", "GB +44"], ["+1", "US +1"]];
const input = "height:50px;padding:0 14px;border-radius:12px;background:#FFFFFF;font-size:16px;color:#1C2430";
const lbl = "font-size:14px;font-weight:600;color:#0B1F3A";
const cap = "font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684";
// The lead form's messages (design/flow).
const MESSAGES = { name: "Please enter your full name", phone: "Please enter a valid WhatsApp number" };

export function Settings({ initial, preview }: { initial: SettingsData; preview?: { confirm?: boolean } }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone", string>>>({});
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(!!preview?.confirm);
  const [deleted, setDeleted] = useState(false);
  const set = <K extends keyof SettingsData>(k: K, val: SettingsData[K]) => { setV({ ...v, [k]: val }); setSaved(false); if (k === "name" || k === "phone") setErrors((e) => ({ ...e, [k]: undefined })); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailed(false);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v.name, cc: v.cc, phone: v.phone, retest_reminders: v.retest_reminders, updates: v.updates, monthly_checkup: v.monthly_checkup }) }).catch(() => null);
    if (res?.ok) { setSaved(true); return; }
    const body = await res?.json().catch(() => ({})) ?? {};
    if (res?.status === 422 && Array.isArray(body.fields)) {
      const next: Partial<Record<"name" | "phone", string>> = {};
      for (const f of body.fields as ("name" | "phone")[]) next[f] = MESSAGES[f];
      setErrors(next);
      document.getElementById(body.fields.includes("name") ? "st-name" : "st-phone")?.focus();
      return;
    }
    setFailed(true);
  };
  const doDelete = async () => {
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 204)) { setDeleted(true); setConfirm(false); window.scrollTo(0, 0); } else setFailed(true);
  };

  const prefs: [keyof SettingsData, string, string, string][] = [
    ["retest_reminders", "st-retest", "Retest reminder", `An email when your ${v.retest_days}-day retest date arrives.`],
    ["monthly_checkup", "st-monthly", "Monthly check-up", "A reminder each month to upload your latest statement."],
    ["updates", "st-updates", "Updates from Beta", "Occasional news about webinars and tools."],
  ];
  const border = (k: "name" | "phone") => `1px solid ${errors[k] ? "#A23B2E" : "#DDE2E7"}`;

  return (
    <section className="ac-wrap" style={sx("padding-top:clamp(24px,4vw,48px);padding-bottom:clamp(56px,8vw,104px);display:flex;flex-direction:column;gap:20px;max-width:800px")}>
      <h1 style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(30px,3.6vw,44px);font-weight:700;letter-spacing:-0.04em;line-height:1.04;color:#0B1F3A")}>Settings</h1>
      {!deleted && (
        <>
          <form onSubmit={save} noValidate data-testid="settings" className="ac-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:18px")}>
            <span style={sx(cap)}>Your details</span>
            <div style={sx("display:flex;flex-direction:column;gap:7px")}>
              <label htmlFor="st-name" style={sx(lbl)}>Full name</label>
              <input id="st-name" type="text" autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} style={{ ...sx(input), border: border("name") }} />
              {errors.name && <span role="alert" style={sx("font-size:13px;color:#A23B2E")}>{errors.name}</span>}
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:7px")}>
              <label htmlFor="st-phone" style={sx(lbl)}>Phone (WhatsApp)</label>
              <div style={sx("display:flex;gap:8px")}>
                <select aria-label="Country code" value={v.cc} onChange={(e) => set("cc", e.target.value)} style={sx("height:50px;width:112px;flex-shrink:0;padding:0 10px;border-radius:12px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:15px;font-weight:600;color:#0B1F3A")}>
                  {COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
                <input id="st-phone" type="tel" autoComplete="tel-national" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} style={{ ...sx("height:50px;min-width:0;flex:1;padding:0 14px;border-radius:12px;background:#FFFFFF;font-size:16px;color:#1C2430"), border: border("phone") }} />
              </div>
              {errors.phone && <span role="alert" style={sx("font-size:13px;color:#A23B2E")}>{errors.phone}</span>}
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:7px")}>
              <label htmlFor="st-email" style={sx(lbl)}>Email</label>
              <input id="st-email" type="email" autoComplete="email" value={v.email} readOnly aria-readonly="true" style={sx(input + ";border:1px solid #DDE2E7")} />
              <span style={sx("font-size:13px;color:#6B7684")}>Sign-in links and reports go to this address.</span>
            </div>
            <span style={sx("margin-top:8px;padding-top:20px;border-top:1px solid #DDE2E7;" + cap)}>Email preferences</span>
            {prefs.map(([k, id, label, help]) => {
              const on = v[k] as boolean;
              return (
                <div key={k} style={sx("display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px")}>
                  <div style={sx("display:flex;flex-direction:column;gap:2px")}>
                    <span id={id} style={sx("font-size:15px;font-weight:600;color:#0B1F3A")}>{label}</span>
                    <span style={sx("font-size:13px;line-height:1.45;color:#6B7684")}>{help}</span>
                  </div>
                  <button type="button" role="switch" aria-checked={on} aria-labelledby={id} onClick={() => set(k, !on as never)} style={{ ...sx("position:relative;width:52px;height:32px;flex-shrink:0;border:none;border-radius:999px;cursor:pointer;padding:0"), background: on ? "#0E6B4F" : "#8A94A3" }}>
                    <span style={{ ...sx("position:absolute;top:3px;width:26px;height:26px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 3px rgba(11,31,58,0.25);transition:left 0.15s"), left: on ? 23 : 3 }}></span>
                  </button>
                </div>
              );
            })}
            <div style={sx("display:flex;align-items:center;gap:16px;padding-top:6px")}>
              <button type="submit" style={sx("height:52px;padding:0 28px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer")}>Save changes</button>
              {saved && <span role="status" style={sx("font-size:14px;font-weight:600;color:#0E6B4F")}>Saved</span>}
              {failed && <span role="alert" style={sx("font-size:13px;color:#A23B2E")}>{errorCopy("server").join(" ")}</span>}
            </div>
          </form>
          <div className="ac-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;gap:14px")}>
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#A23B2E")}>Delete account</span>
            <p style={sx("margin:0;font-size:15px;line-height:1.55;color:#1C2430")}>Deletes your profile, score history, reports and goals. Your statements were never stored.</p>
            {!confirm && <button type="button" onClick={() => setConfirm(true)} style={sx("align-self:flex-start;height:48px;padding:0 22px;border-radius:999px;border:1px solid #A23B2E;background:#FFFFFF;color:#A23B2E;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer")}>Delete my account and data</button>}
            {confirm && (
              <div role="alertdialog" aria-labelledby="st-del-t" style={sx("display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:16px;background:#F5E4E1;border:1px solid rgba(162,59,46,0.25)")}>
                <span id="st-del-t" style={sx("font-family:var(--site-font-display);font-size:20px;font-weight:700;color:#7A2A20")}>Delete your account and data?</span>
                <span style={sx("font-size:14px;line-height:1.55;color:#1C2430")}>This can't be undone. You can always take the test again later with a new account.</span>
                <div style={sx("display:flex;flex-wrap:wrap;gap:10px")}>
                  <button type="button" onClick={doDelete} style={sx("height:48px;padding:0 22px;border:none;border-radius:999px;background:#A23B2E;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer")}>Yes, delete everything</button>
                  <button type="button" onClick={() => setConfirm(false)} style={sx("height:48px;padding:0 22px;border-radius:999px;border:1px solid #0B1F3A;background:#FFFFFF;color:#0B1F3A;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer")}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {deleted && (
        <div role="status" data-testid="deleted" className="ac-pad" style={sx("background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column;align-items:flex-start;gap:12px")}>
          <span style={sx("font-family:var(--site-font-display);font-size:24px;font-weight:700;color:#0B1F3A")}>Your account and data have been deleted.</span>
          <span style={sx("font-size:15px;line-height:1.55;color:#4C5A6E")}>We've sent a confirmation to your email. Thank you for taking the Manager Test.</span>
          <a href="/" style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:700;color:#0E6B4F")}>Back to the Manager Test</a>
        </div>
      )}
    </section>
  );
}
