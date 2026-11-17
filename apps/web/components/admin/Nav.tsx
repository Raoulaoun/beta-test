"use client";
import { usePathname } from "next/navigation";
import { sx } from "../../lib/sx.ts";

const ITEMS = [
  ["/admin", "Leads"], ["/admin/pipeline", "Pipeline"], ["/admin/funnel", "Funnel"], ["/admin/dropoffs", "Drop-offs"], ["/admin/settings", "Settings"],
] as const;

export function AdminNav({ counts }: { counts: Record<string, number | undefined> }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" style={sx("display:flex;flex-direction:column;gap:2px")}>
      {ITEMS.map(([href, label]) => {
        const on = href === "/admin" ? path === "/admin" || path.startsWith("/admin/leads") : path.startsWith(href);
        const count = counts[href];
        return (
          <a key={href} href={href} aria-current={on ? "page" : undefined} style={{ ...sx("display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:0 12px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;text-align:left"), background: on ? "rgba(245,246,244,0.1)" : "transparent", color: on ? "#F5F6F4" : "#C3CBD5" }}>
            {label}<span style={{ ...sx("font-size:12px;font-weight:700"), color: on ? "#9FDCBE" : "#7C8AA0" }}>{count ?? ""}</span>
          </a>
        );
      })}
    </nav>
  );
}
