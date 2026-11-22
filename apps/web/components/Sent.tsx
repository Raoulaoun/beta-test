"use client";
import { sx } from "../lib/sx.ts";
import type { Links } from "../lib/server/settings.ts";
import { Tick } from "./Chrome.tsx";
import { useMe } from "./AccountAvatar.tsx";

// Confirmation screen, from design/flow ("REPORT SENT"). The share-card panel arrives with
// the share cards in Phase 7. Links come from /admin settings; an empty link hides its card.
export function Sent({ sentTo, links }: { sentTo: string; links: Links }) {
  const me = useMe(); // the form signed this browser in (unless the email belongs to someone else)
  const card = "display:flex;align-items:center;gap:16px;padding:22px;border-radius:20px;background:#FFFFFF;border:1px solid #DDE2E7;color:#0B1F3A";
  return (
    <section className="mt-wrap" data-testid="sent" style={sx("padding-top:clamp(24px,5vw,64px);padding-bottom:clamp(56px,8vw,104px)")}>
      <div style={sx("display:flex;flex-direction:column;align-items:flex-start;gap:14px;margin-bottom:clamp(28px,4vw,48px)")}>
        <span style={sx("width:56px;height:56px;border-radius:50%;background:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Tick size={26} width="2.6" /></span>
        <h1 style={sx("font-family:var(--site-font-display);font-size:clamp(34px,5vw,60px);font-weight:700;letter-spacing:-0.04em;line-height:1;color:#0B1F3A;margin:6px 0 0")}>Your report is on its way</h1>
        <p style={sx("margin:0;font-size:17px;line-height:1.5;color:#1C2430")}>to <strong style={sx("font-weight:700;color:#0B1F3A")}>{sentTo}</strong></p>
      </div>
      <div style={sx("display:flex;flex-direction:column;gap:16px;min-width:0;max-width:680px")}>
        <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Next steps</span>
        {me?.signedIn && (
          <div data-testid="dashboard-ready" style={sx("display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;padding:20px 22px;border-radius:20px;background:#FFFFFF;border:1.5px solid #0B1F3A")}>
            <span aria-hidden="true" style={sx("width:44px;height:44px;flex-shrink:0;border-radius:14px;background:#E6ECF5;color:#0B1F3A;display:flex;align-items:center;justify-content:center")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect></svg></span>
            <span style={sx("display:flex;flex-direction:column;gap:2px;min-width:200px;flex:1")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;letter-spacing:-0.015em;color:#0B1F3A")}>Your dashboard is ready</span><span style={sx("font-size:14px;line-height:1.45;color:#4C5A6E")}>Score history, goals and coach notes. You're signed in on this browser.</span></span>
            <a href="/dashboard" className="mt-hover-navybg" style={sx("display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 22px;border-radius:999px;background:#0B1F3A;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap")}>Open my dashboard</a>
          </div>
        )}
        {links.link_webinar && (
          <a href={links.link_webinar} data-testid="link-webinar" style={sx("position:relative;overflow:hidden;display:flex;flex-direction:column;gap:10px;padding:26px;border-radius:24px;background:linear-gradient(162deg,#0E6B4F 0%,#0E4A44 50%,#0B1F3A 100%);color:#F5F6F4")}>
            <span style={sx("display:inline-flex;align-self:flex-start;align-items:center;min-height:28px;padding:4px 12px;border-radius:999px;background:rgba(245,246,244,0.12);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9FDCBE")}>Free webinar</span>
            <span style={sx("font-family:var(--site-font-display);font-size:clamp(22px,2.4vw,26px);font-weight:700;letter-spacing:-0.025em;line-height:1.12;color:#F5F6F4")}>Your Money Management Journey Starts Here</span>
            <span style={sx("font-size:15px;line-height:1.55;color:rgba(245,246,244,0.82)")}>From trading for friends to managing professionally, bring your score</span>
            <span style={sx("display:inline-flex;align-items:center;gap:8px;margin-top:6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#F5F6F4")}>Save my seat →</span>
          </a>
        )}
        <div style={sx("display:grid;grid-template-columns:minmax(0,1fr);gap:16px")}>
          {links.link_managers_room && (
            <a href={links.link_managers_room} data-testid="link-room" className="mt-hover-border" style={sx(card)}>
              <span style={sx("width:44px;height:44px;flex-shrink:0;border-radius:14px;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"></path><path d="M22 2 11 13"></path></svg></span>
              <span style={sx("display:flex;flex-direction:column;gap:2px;min-width:0;flex:1")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;letter-spacing:-0.015em")}>Join the Beta Managers Room</span><span style={sx("font-size:14px;color:#6B7684")}>Telegram</span></span>
              <span style={sx("font-size:20px;color:#0E6B4F")}>→</span>
            </a>
          )}
          {links.link_beta && (
            <a href={links.link_beta} target="_blank" rel="noopener" data-testid="link-beta" className="mt-hover-border" style={sx(card)}>
              <span style={sx("width:44px;height:44px;flex-shrink:0;border-radius:14px;background:#E7F1ED;display:flex;align-items:center;justify-content:center")}><img src="/brand/beta-mark-dark.png" alt="" style={sx("height:20px;width:auto;display:block")} /></span>
              <span style={sx("display:flex;flex-direction:column;gap:2px;min-width:0;flex:1")}><span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;letter-spacing:-0.015em")}>How traders manage money with Beta</span><span style={sx("font-size:14px;color:#6B7684")}>{hostOf(links.link_beta)}</span></span>
              <span style={sx("font-size:20px;color:#0E6B4F")}>→</span>
            </a>
          )}
        </div>
        <p style={sx("display:flex;align-items:center;gap:10px;margin:4px 0 0;font-size:14px;line-height:1.5;color:#6B7684")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E6B4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={sx("flex-shrink:0")}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path></svg>Improving your record? Take the test again in 60 days.</p>
      </div>
    </section>
  );
}

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}
