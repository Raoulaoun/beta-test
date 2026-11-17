import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sx } from "../../../lib/sx.ts";
import { adminFromCookie } from "../../../lib/server/adminAuth.ts";
import { countLeads, dropoffCount } from "../../../lib/server/admin.ts";
import { AdminNav } from "../../../components/admin/Nav.tsx";
import { SignOut } from "../../../components/admin/SignOut.tsx";

export const metadata: Metadata = { title: "Manager Test · Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await adminFromCookie((await headers()).get("cookie"));
  if (!admin) redirect("/admin/login");
  const [leads, drops] = await Promise.all([countLeads(), dropoffCount()]);
  return (
    <div style={sx("font-family:var(--site-font-body);color:#1C2430;background:#F3F4F2;min-height:100vh;min-width:1280px;display:grid;grid-template-columns:240px minmax(0,1fr)")}>
      <aside style={sx("background:#0B1F3A;color:#C3CBD5;padding:24px 16px;display:flex;flex-direction:column;gap:28px;position:sticky;top:0;height:100vh")}>
        <div style={sx("display:flex;flex-direction:column;gap:6px;padding:0 8px")}>
          <div style={sx("display:flex;align-items:center;gap:10px")}><img src="/brand/beta-mark-light.png" alt="Beta" style={sx("height:22px;width:auto;display:block")} /><span style={sx("font-family:var(--site-font-display);font-size:20px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#F5F6F4")}>beta</span></div>
          <span style={sx("font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9AA5B3")}>Manager Test · Admin</span>
        </div>
        <AdminNav counts={{ "/admin": leads, "/admin/dropoffs": drops }} />
        <div style={sx("display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:12px;background:rgba(245,246,244,0.06);border:1px solid rgba(245,246,244,0.1);color:#C3CBD5")}>
          <span style={sx("font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9FDCBE")}>Daily digest</span>
          <span style={sx("font-size:13px;line-height:1.45")}>Sent 08:00 Beirut · new leads scoring 60+</span>
        </div>
        <div style={sx("margin-top:auto;padding:0 8px;display:flex;flex-direction:column;gap:10px;font-size:12px;color:#7C8AA0")}>
          <span>{admin.email}</span>
          <SignOut />
          <span>managertest.betaapp.me</span>
        </div>
      </aside>
      <main style={sx("min-width:0;padding:28px 36px 48px;display:flex;flex-direction:column;gap:20px")}>{children}</main>
    </div>
  );
}
