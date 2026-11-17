"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sx } from "../../lib/sx.ts";
import { label } from "./ui.tsx";

type Opt = readonly [string, string];
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function StageSelect({ accountId, stage, stages, compact }: { accountId: string; stage: string; stages: readonly Opt[]; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(stage);
  const change = async (v: string) => {
    setValue(v);
    const res = await post("/api/admin/stage", { account_id: accountId, stage: v });
    if (res.ok) router.refresh(); else setValue(stage);
  };
  const sel = (
    <select aria-label="Stage" data-testid="stage-select" value={value} onChange={(e) => change(e.target.value)}
      style={sx(compact ? "height:34px;padding:0 8px;border-radius:8px;border:1px solid #DDE2E7;background:#FAFAF8;font-size:12px;color:#0B1F3A"
        : "height:44px;min-width:200px;padding:0 12px;border-radius:10px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:14px;font-weight:600;color:#0B1F3A")}>
      {stages.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
  return compact ? sel : <label style={sx(label)}>Stage{sel}</label>;
}

export function NoteForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const add = async () => {
    const t = draft.trim();
    if (!t) return;
    const res = await post("/api/admin/notes", { account_id: accountId, body: t });
    if (res.ok) { setDraft(""); router.refresh(); }
  };
  return (
    <>
      <textarea id="ad-note" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note about this lead" style={sx("padding:12px 14px;border-radius:12px;border:1px solid #DDE2E7;font-size:14px;line-height:1.5;color:#1C2430;resize:vertical")} />
      <button type="button" onClick={add} style={sx("align-self:flex-end;height:40px;padding:0 18px;border:none;border-radius:999px;background:#0B1F3A;color:#FFFFFF;font-size:13px;font-weight:600;cursor:pointer")}>Add note</button>
    </>
  );
}
