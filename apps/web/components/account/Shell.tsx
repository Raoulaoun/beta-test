import { sx } from "../../lib/sx.ts";
import { RenewSession } from "./Renew.tsx";

// Header and page frame from design/account. Signed in: Dashboard / Settings and the
// initials avatar.
export function AccountShell({ current, initials, children }: { current?: "dashboard" | "settings"; initials?: string; children: React.ReactNode }) {
  const nav: [string, string, "dashboard" | "settings"][] = [["/dashboard", "Dashboard", "dashboard"], ["/settings", "Settings", "settings"]];
  return (
    <div style={sx("font-family:var(--site-font-body);color:#1C2430;background:#FAFAF8;min-height:100vh;display:flex;flex-direction:column")}>
      <header className="ac-wrap" style={sx("height:72px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #DDE2E7")}>
        <a href="/" style={sx("display:flex;align-items:center;gap:12px;min-width:0")}>
          <img src="/brand/beta-mark-dark.png" alt="Beta" style={sx("height:24px;width:auto;display:block")} />
          <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#0B1F3A")}>beta</span>
          <span className="ac-dsk" style={sx("width:1px;height:20px;background:#DDE2E7")}></span>
          <span className="ac-dsk" style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684;white-space:nowrap")}>The Manager Test</span>
        </a>
        {current && (
          <nav aria-label="Account" style={sx("display:flex;align-items:center;gap:4px")}>
            {nav.map(([href, label, key]) => (
              <a key={key} href={href} aria-current={current === key ? "page" : undefined} style={{ ...sx("min-height:44px;padding:0 14px;border:none;border-radius:999px;color:#0B1F3A;font-size:14px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center"), background: current === key ? "#E7F1ED" : "transparent" }}>{label}</a>
            ))}
            <span aria-hidden="true" style={sx("width:36px;height:36px;margin-left:6px;border-radius:50%;background:#0B1F3A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700")}>{initials}</span>
          </nav>
        )}
      </header>
      <main style={sx("flex:1")}>{children}</main>
      {current && <RenewSession />}
    </div>
  );
}
