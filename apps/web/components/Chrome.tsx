import { sx } from "../lib/sx.ts";

export const DISCLAIMER =
  "The Manager Test analyzes past trading results for educational purposes only. It is not investment advice, does not predict future performance, and is not an assessment for admission to the Beta platform. Results depend entirely on the statement provided.";

export function AppHeader({ onHome }: { onHome: (e: React.MouseEvent) => void }) {
  return (
    <header className="mt-wrap" style={sx("height:72px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #DDE2E7")}>
      <a href="/" onClick={onHome} style={sx("display:flex;align-items:center;gap:12px;min-width:0")}>
        <img src="/brand/beta-mark-dark.png" alt="Beta" style={sx("height:24px;width:auto;display:block")} />
        <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#0B1F3A")}>beta</span>
        <span style={sx("width:1px;height:20px;background:#DDE2E7")}></span>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684;white-space:nowrap")}>The Manager Test</span>
      </a>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={sx("background:#0B1F3A;color:#C3CBD5;margin-top:0")}>
      <div className="mt-wrap" style={sx("padding-top:48px;padding-bottom:40px")}>
        <div className="mt-foot">
          <div style={sx("display:flex;flex-direction:column;gap:16px")}>
            <div style={sx("display:flex;align-items:center;gap:10px")}><img src="/brand/beta-mark-light.png" alt="Beta" style={sx("height:22px;width:auto;display:block")} /><span style={sx("font-family:var(--site-font-display);font-size:20px;font-weight:700;letter-spacing:-0.035em;line-height:1;color:#F5F6F4")}>beta</span></div>
            <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;letter-spacing:-0.025em;color:#F5F6F4")}>Managed, never held.</span>
            <p style={sx("margin:0;font-size:13px;line-height:1.6;color:#9AA5B3;max-width:62ch")}>{DISCLAIMER}</p>
          </div>
          <nav aria-label="Footer" style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:4px")}>
            {/* "Free calculators →" (Phase 6) and "Privacy policy" (Phase 8) return when their pages ship. */}
            <a href="https://betaapp.me" className="mt-hover-light" style={sx("display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:500;color:#C3CBD5")}>betaapp.me</a>
          </nav>
        </div>
        <div style={sx("margin-top:32px;padding-top:20px;border-top:1px solid rgba(245,246,244,0.12);font-size:12px;color:#7C8AA0")}>managertest.betaapp.me · The Manager Test by Beta</div>
      </div>
    </footer>
  );
}

export const FileIcon = ({ size = 18, extra }: { size?: number; extra?: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path>{extra}</svg>
);

export const Tick = ({ size, width, color = "#FFFFFF", style }: { size: number; width: string; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M20 6 9 17l-5-5"></path></svg>
);

export const Spinner = ({ css }: { css: string }) => <span className="mt-spin" style={sx(css)}></span>;
