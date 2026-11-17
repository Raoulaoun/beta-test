"use client";
import { useState } from "react";
import { sx } from "../../lib/sx.ts";

type Links = { link_webinar: string; link_managers_room: string; link_beta: string };
const FIELDS: [keyof Links, string][] = [["link_webinar", "Webinar"], ["link_managers_room", "Beta Managers Room"], ["link_beta", "Beta page"]];
const input = "height:44px;padding:0 14px;border-radius:12px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:14px;color:#1C2430";

// Confirmation-screen links. Built from existing admin pieces (approved).
export function SettingsForm({ initial }: { initial: Links }) {
  const [v, setV] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) });
    setState(res.ok ? "saved" : "error");
  };
  return (
    <form onSubmit={save} data-testid="settings-form" style={sx("max-width:720px;padding:24px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:16px")}>
      <span style={sx("font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4C5A6E")}>Confirmation-screen links</span>
      {FIELDS.map(([k, label]) => (
        <label key={k} style={sx("display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#0B1F3A")}>{label}
          <input name={k} type="url" placeholder="https://…" value={v[k]} onChange={(e) => { setV({ ...v, [k]: e.target.value }); setState("idle"); }} style={sx(input)} />
        </label>
      ))}
      <span style={sx("font-size:13px;color:#6B7684")}>An empty link hides that card. Links must start with https://.</span>
      <div style={sx("display:flex;align-items:center;gap:14px")}>
        <button type="submit" style={sx("height:44px;padding:0 22px;border:none;border-radius:999px;background:#0B1F3A;color:#FFFFFF;font-size:13px;font-weight:600;cursor:pointer")}>Save</button>
        {state === "saved" && <span role="status" style={sx("font-size:13px;font-weight:600;color:#0E6B4F")}>Saved</span>}
        {state === "error" && <span role="alert" style={sx("font-size:13px;font-weight:600;color:#A23B2E")}>Check the links: each must start with https://</span>}
      </div>
    </form>
  );
}
