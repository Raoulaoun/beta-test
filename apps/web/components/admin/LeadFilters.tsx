"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { sx } from "../../lib/sx.ts";
import { label, select } from "./ui.tsx";

type Opt = readonly [string, string];

export function LeadFilters({ bands, campaigns, stages }: { bands: readonly Opt[]; campaigns: string[]; stages: readonly Opt[] }) {
  const router = useRouter();
  const q = useSearchParams();
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(q.toString());
    if (v) n.set(k, v); else n.delete(k);
    router.push(`/admin?${n.toString()}`);
  };
  return (
    <div style={sx("display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:16px;border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7")}>
      <label style={sx(label)}>Band<select value={q.get("band") ?? ""} onChange={(e) => set("band", e.target.value)} style={{ ...sx(select), minWidth: 170 }}><option value="">All bands</option>{bands.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label style={sx(label)}>Min score<input type="number" min={0} max={100} defaultValue={q.get("min") ?? ""} onBlur={(e) => set("min", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") set("min", (e.target as HTMLInputElement).value); }} style={sx("height:40px;width:96px;padding:0 10px;border-radius:10px;border:1px solid #DDE2E7;font-size:14px;color:#0B1F3A")} /></label>
      <label style={sx(label)}>Campaign<select value={q.get("campaign") ?? ""} onChange={(e) => set("campaign", e.target.value)} style={{ ...sx(select), minWidth: 190 }}><option value="">All campaigns</option>{campaigns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
      <label style={sx(label)}>Stage<select value={q.get("stage") ?? ""} onChange={(e) => set("stage", e.target.value)} style={{ ...sx(select), minWidth: 180 }}><option value="">All stages</option>{stages.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label style={sx(label)}>Date<select value={q.get("days") ?? ""} onChange={(e) => set("days", e.target.value)} style={{ ...sx(select), minWidth: 150 }}><option value="">All time</option><option value="7">Last 7 days</option><option value="3">Last 3 days</option><option value="1">Today</option></select></label>
      <button type="button" onClick={() => router.push("/admin")} style={sx("height:40px;padding:0 14px;border:none;background:transparent;color:#0E6B4F;font-size:13px;font-weight:600;cursor:pointer")}>Clear filters</button>
    </div>
  );
}
