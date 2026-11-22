import { sx } from "../../lib/sx.ts";
import { RenewSession } from "./Renew.tsx";
import { AccountMenu } from "./Menu.tsx";

// Header and page frame from design/account. Signed in: Dashboard / Settings (desktop) and
// the avatar menu with Sign out.
type Account = { initials: string; name: string; email: string };
type Props = { current?: "dashboard" | "settings"; account?: Account; preview?: boolean; openMenu?: boolean; children: React.ReactNode };

export function AccountShell({ current, account, preview, openMenu, children }: Props) {
  return (
    <div style={sx("font-family:var(--site-font-body);color:#1C2430;background:#FAFAF8;min-height:100vh;display:flex;flex-direction:column")}>
      <header className="ac-wrap" style={sx("height:72px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #DDE2E7")}>
        <a href="/" style={sx("display:flex;align-items:center;gap:12px;min-width:0")}>
          <img src="/brand/beta-mark-dark.png" alt="Beta" style={sx("height:24px;width:auto;display:block")} />
          <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#0B1F3A")}>beta</span>
          <span className="ac-dsk" style={sx("width:1px;height:20px;background:#DDE2E7")}></span>
          <span className="ac-dsk" style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684;white-space:nowrap")}>The Manager Test</span>
        </a>
        {current && account && <AccountMenu current={current} {...account} preview={preview} openMenu={openMenu} />}
      </header>
      <main style={sx("flex:1")}>{children}</main>
      {current && !preview && <RenewSession />}
    </div>
  );
}
