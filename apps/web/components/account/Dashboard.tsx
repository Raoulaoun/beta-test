"use client";
import { useMemo, useState } from "react";
import { sx } from "../../lib/sx.ts";
import { DISCLAIMER } from "../Chrome.tsx";
import { accountMeta, bandLabel, chart, deltaLabel, firstName, longDate, ringDash, starterLine, type TradingAccount } from "../../lib/accountView.ts";

// Dashboard (design/account, view=dashboard). Data from lib/server/dashboard.ts.

type GoalCard = { title: string; pct: number; fromLabel: string; nowLabel: string; toLabel: string; note: string; kind: "pillar" | "band"; pillar?: string | null; band?: string };
type Options = { pillars: { key: string; name: string; score: number; targets: number[] }[]; bands: { code: string; name: string; floor: number }[] };
export type GoalState =
  | { state: "none"; options?: Options }
  | { state: "auto" | "active"; goal: GoalCard; options: Options }
  | { state: "reached"; goal: GoalCard; options: Options; reached: { title: string; line: string }; next: { title: string } };
export type DashData = { name: string | null; trading_accounts: TradingAccount[]; default_trading_account: string | null; goal: GoalState };

const label12 = "font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684";
const card = "background:#FFFFFF;border:1px solid #DDE2E7;border-radius:24px;display:flex;flex-direction:column";
const select = "height:46px;padding:0 10px;border-radius:12px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:15px;color:#0B1F3A";

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3"></path><path d="m7 8 5-5 5 5"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path></svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path></svg>
);
const Check = ({ size, width }: { size: number; width: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
);
const pdfHref = (id: string) => `/api/results/${id}/pdf`;
const upload = () => { window.location.href = "/"; };

export function Dashboard({ data, preview }: { data: DashData; preview?: { acctOpen?: boolean; goal?: "change"; kind?: "pillar" | "band" } }) {
  const accts = data.trading_accounts;
  const [key, setKey] = useState(data.default_trading_account ?? accts[0]?.key);
  const [acctOpen, setAcctOpen] = useState(!!preview?.acctOpen);
  const A = accts.find((a) => a.key === key) ?? accts[0];
  const multi = accts.length > 1;
  const scored = A ? A.results.filter((r) => r.on_chart) : [];
  const latest = scored[0];
  const first = scored.length <= 1;
  const ch = useMemo(() => chart(A?.results ?? []), [A]);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = ch.points.find((p) => p.id === selId) ?? ch.points[ch.points.length - 1];
  const starters = A ? A.results.filter((r) => r.score_type === "starter") : [];
  const pick = (k: string) => { setKey(k); setAcctOpen(false); setSelId(null); };
  const hello = firstName(data.name);

  return (
    <>
      <section className="ac-wrap" style={sx("padding-top:clamp(24px,4vw,48px);padding-bottom:clamp(40px,6vw,80px);display:flex;flex-direction:column;gap:clamp(20px,3vw,32px)")}>
        <div style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:16px")}>
          <div style={sx("display:flex;flex-direction:column;gap:6px")}>
            <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Your dashboard</span>
            <h1 style={sx("margin:0;font-family:var(--site-font-display);font-size:clamp(30px,3.6vw,44px);font-weight:700;letter-spacing:-0.04em;line-height:1.04;color:#0B1F3A")}>{hello ? `Welcome back, ${hello}` : "Welcome back"}</h1>
            {A && multi && (
              <div style={sx("position:relative;margin-top:6px;align-self:flex-start")}>
                <button type="button" data-testid="account-switcher" onClick={() => setAcctOpen(!acctOpen)} aria-haspopup="listbox" aria-expanded={acctOpen} style={sx("display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 14px 0 16px;border-radius:999px;border:1px solid #DDE2E7;background:#FFFFFF;color:#0B1F3A;font-size:14px;font-weight:600;cursor:pointer")}>
                  <span style={sx("width:8px;height:8px;border-radius:50%;background:#0E6B4F")}></span>{A.label.name} <span style={sx("letter-spacing:0.06em;color:#4C5A6E")}>{A.label.detail}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                </button>
                {acctOpen && (
                  <div role="listbox" aria-label="Trading accounts" style={sx("position:absolute;top:calc(100% + 8px);left:0;z-index:10;min-width:300px;padding:8px;border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7;box-shadow:0 18px 40px rgba(11,31,58,0.14);display:flex;flex-direction:column;gap:2px")}>
                    {accts.map((a) => {
                      const l = a.results.find((r) => r.on_chart) ?? a.results[0];
                      const on = a.key === A.key;
                      return (
                        <button key={a.key} type="button" role="option" aria-selected={on} onClick={() => pick(a.key)} style={{ ...sx("display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-height:56px;padding:8px 12px;border:none;border-radius:12px;text-align:left;cursor:pointer"), background: on ? "#E7F1ED" : "transparent" }}>
                          <span style={sx("display:flex;flex-direction:column;gap:2px")}>
                            <span style={sx("font-size:14px;font-weight:700;color:#0B1F3A")}>{a.label.name} <span style={sx("font-weight:600;letter-spacing:0.06em;color:#4C5A6E")}>{a.label.detail}</span></span>
                            <span style={sx("font-size:12px;color:#6B7684")}>{l ? accountMeta(l, a.account_type) : ""}</span>
                          </span>
                          <span style={sx("font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A")}>{l?.score ?? ""}</span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={upload} style={sx("display:flex;align-items:center;gap:8px;min-height:48px;padding:0 12px;margin-top:4px;border:none;border-top:1px solid #EEF0F2;border-radius:0 0 10px 10px;background:transparent;color:#0E6B4F;font-size:14px;font-weight:600;cursor:pointer;text-align:left")}>+ Add another account</button>
                  </div>
                )}
              </div>
            )}
            {A && !multi && (
              <span data-testid="account-chip" style={sx("margin-top:6px;align-self:flex-start;display:inline-flex;align-items:center;gap:10px;min-height:36px;padding:0 14px;border-radius:999px;background:#F3F4F2;color:#0B1F3A;font-size:14px;font-weight:600")}>
                <span style={sx("width:8px;height:8px;border-radius:50%;background:#0E6B4F")}></span>{A.label.name} <span style={sx("letter-spacing:0.06em;color:#4C5A6E")}>{A.label.detail}</span>
              </span>
            )}
          </div>
          <button type="button" onClick={upload} className="ac-dsk" style={sx("align-items:center;gap:10px;height:56px;padding:0 28px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap")}><UploadIcon />Upload a new statement</button>
        </div>

        {A?.since_last.kind === "first_full" && (
          <div role="status" data-testid="first-full" className="ac-pad" style={sx("display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:20px 24px;border-radius:24px;background:#E7F1ED;border:1px solid rgba(14,107,79,0.2)")}>
            <span style={sx("width:64px;height:64px;border-radius:50%;background:#FFFFFF;border:2px solid #0E6B4F;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Check size={28} width="2.2" /></span>
            <div style={sx("display:flex;flex-direction:column;gap:6px")}>
              <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Your first full score</span>
              <span style={sx("font-family:var(--site-font-display);font-size:clamp(22px,2.4vw,28px);font-weight:700;letter-spacing:-0.025em;line-height:1.15;color:#0B1F3A")}>Your record is now deep enough for a full score.</span>
              <span style={sx("font-size:15px;line-height:1.55;color:#1C2430;max-width:70ch")}>You now have more than 3 months and 30 trades, so all five pillars count in full. Your early scores stay in your history, marked as early.</span>
            </div>
          </div>
        )}

        <div className="ac-dash">
          {latest && (
            <div data-testid="latest" style={sx("position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(168deg,#0B1F3A 0%,#0D2C3F 40%,#0E4A44 82%,#0E6B4F 122%);color:#F5F6F4")}>
              <div aria-hidden="true" style={sx("position:absolute;right:-30%;bottom:-40%;width:90%;height:90%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.28),rgba(63,145,116,0))")}></div>
              <div className="ac-pad" style={sx("position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:24px 32px")}>
                <div style={sx("position:relative;width:156px;height:156px;flex-shrink:0")}>
                  <svg viewBox="0 0 200 200" style={sx("width:100%;height:100%;transform:rotate(-90deg)")}><circle cx="100" cy="100" r="88" fill="none" stroke="rgba(245,246,244,0.14)" strokeWidth="12"></circle><circle cx="100" cy="100" r="88" fill="none" stroke="#9FDCBE" strokeWidth="12" strokeLinecap="round" strokeDasharray={ringDash(latest.score ?? 0)}></circle></svg>
                  <div style={sx("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center")}>
                    <span style={sx("font-family:var(--site-font-display);font-size:60px;font-weight:700;letter-spacing:-0.05em;line-height:0.9")}>{latest.score}</span>
                    <span style={sx("font-size:12px;font-weight:600;color:#C3CBD5;margin-top:4px")}>out of 100</span>
                  </div>
                </div>
                <div style={sx("flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px")}>
                  <span style={sx("font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5")}>Latest result</span>
                  <span style={sx("font-family:var(--site-font-display);font-size:28px;font-weight:700;letter-spacing:-0.025em;line-height:1.1;color:#9FDCBE")}>{latest.band?.name}</span>
                  <span style={sx("font-size:14px;line-height:1.5;color:rgba(245,246,244,0.85)")}>{longDate(latest.evaluation_date)} · {accountMeta(latest, A.account_type)}</span>
                  {deltaLabel(A.since_last) && <span data-testid="delta" style={sx("align-self:flex-start;display:inline-flex;align-items:center;min-height:28px;padding:4px 12px;border-radius:999px;background:rgba(159,220,190,0.14);border:1px solid rgba(159,220,190,0.3);font-size:13px;font-weight:700;color:#9FDCBE")}>{deltaLabel(A.since_last)}</span>}
                  <a href={pdfHref(latest.id)} className="ac-hover-light" style={sx("margin-top:6px;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 20px;border-radius:999px;border:1px solid rgba(245,246,244,0.4);color:#F5F6F4;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase")}><DownloadIcon />Download report</a>
                </div>
              </div>
            </div>
          )}
          {data.goal.state !== "none" && <Goal initial={data.goal} preview={preview} />}

          {A && (
            <div className="ac-span ac-pad" data-testid="history" style={sx(card + ";gap:18px")}>
              <div style={sx("display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px")}>
                <span style={sx(label12)}>Score history</span>
                <span style={sx("font-size:13px;color:#6B7684")}>{first ? "1 upload" : "Tap a point to see its pillars"}</span>
              </div>
              {!first && (
                <>
                  <div style={sx("display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px")}>
                    <div style={sx("position:relative;height:220px;font-size:11px;color:#6B7684")}>
                      {ch.ticks.map((t) => <span key={t.v} style={{ position: "absolute", top: `${t.top}%`, transform: "translateY(-50%)" }}>{t.v}</span>)}
                    </div>
                    <div style={sx("position:relative;height:220px")}>
                      <div style={sx("position:absolute;inset:0;border-top:1px dashed #DDE2E7;border-bottom:1px solid #DDE2E7")}></div>
                      {ch.ticks.slice(1, -1).map((t) => <div key={t.v} style={{ ...sx("position:absolute;left:0;right:0;border-top:1px dashed #DDE2E7"), top: `${t.top}%` }}></div>)}
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={sx("position:absolute;inset:0;width:100%;height:100%;overflow:visible")}>
                        <polyline points={ch.linePtsEarly} fill="none" stroke="#7C8AA0" strokeWidth="2" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"></polyline>
                        <polyline points={ch.linePts} fill="none" stroke="#0E6B4F" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"></polyline>
                      </svg>
                      {ch.points.map((p) => {
                        const on = p.id === sel?.id;
                        return (
                          <span key={p.id}>
                            <button type="button" data-testid="chart-point" onClick={() => setSelId(p.id)} onMouseEnter={() => setSelId(p.id)} onFocus={() => setSelId(p.id)} aria-pressed={on} aria-label={`${p.date}, ${p.early ? "early score" : "score"} ${p.score}`}
                              style={{ ...sx("position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;border:none;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center"), left: `${p.x}%`, top: `${p.y}%` }}>
                              <span style={{ ...sx("border-radius:50%"), width: on ? 18 : 14, height: on ? 18 : 14, background: p.early ? "#FFFFFF" : "#0E6B4F", border: `2.5px solid ${p.early ? "#7C8AA0" : "#0E6B4F"}`, boxShadow: `0 0 0 ${on ? "5px" : "3px"} ${on ? "rgba(14,107,79,0.18)" : "#FFFFFF"}` }}></span>
                            </button>
                            <span style={{ ...sx("position:absolute;transform:translate(-50%,-100%);font-family:var(--site-font-display);font-size:16px;font-weight:700;pointer-events:none"), left: `${p.x}%`, top: `calc(${p.y}% - 16px)`, color: p.early ? "#4C5A6E" : "#0B1F3A" }}>{p.score}</span>
                            {p.early && <span style={{ ...sx("position:absolute;transform:translateX(-50%);padding:1px 7px;border-radius:999px;background:#F3F4F2;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#4C5A6E;pointer-events:none"), left: `${p.x}%`, top: `calc(${p.y}% + 16px)` }}>Early</span>}
                          </span>
                        );
                      })}
                    </div>
                    <span></span>
                    <div style={sx("position:relative;height:20px;font-size:12px;color:#6B7684")}>
                      {ch.points.map((p) => <span key={p.id} style={{ position: "absolute", left: `${p.x}%`, transform: `translateX(${p.tx})`, whiteSpace: "nowrap" }}>{p.short}</span>)}
                    </div>
                  </div>
                  <div style={sx("display:flex;flex-wrap:wrap;gap:8px 20px;font-size:12.5px;color:#4C5A6E")}>
                    <span style={sx("display:inline-flex;align-items:center;gap:8px")}><span style={sx("width:12px;height:12px;border-radius:50%;background:#0E6B4F")}></span>Full score</span>
                    <span style={sx("display:inline-flex;align-items:center;gap:8px")}><span style={sx("width:12px;height:12px;border-radius:50%;background:#FFFFFF;border:2px solid #7C8AA0")}></span>Early score, under 3 months or 30 trades</span>
                  </div>
                  {starters.map((r) => { const l = starterLine(r); return (
                    <div key={r.id} data-testid="starter-row" style={sx("display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:14px;padding:12px 16px;border-radius:14px;border:1px dashed #B8C0CA")}>
                      <span style={sx("width:36px;height:36px;border-radius:10px;background:#F3F4F2;color:#4C5A6E;display:flex;align-items:center;justify-content:center")}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path></svg></span>
                      <div style={sx("display:flex;flex-direction:column;gap:2px")}>
                        <span style={sx("font-size:14px;font-weight:700;color:#0B1F3A")}>{l.title}</span>
                        <span style={sx("font-size:13px;color:#4C5A6E")}>{l.body}</span>
                      </div>
                    </div>
                  ); })}
                  {sel && (
                    <div data-testid="selected" style={sx("padding:18px;border-radius:16px;background:#FAFAF8;border:1px solid #DDE2E7;display:flex;flex-direction:column;gap:12px")}>
                      <span style={sx("font-size:14px;font-weight:700;color:#0B1F3A")}>{sel.title}</span>
                      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 20px")}>
                        {sel.pillars.map((q) => (
                          <div key={q.name} style={sx("display:flex;flex-direction:column;gap:6px")}>
                            <div style={sx("display:flex;justify-content:space-between;font-size:13px")}><span style={sx("color:#1C2430")}>{q.name}</span><span style={sx("font-weight:700;color:#0B1F3A")}>{q.score}</span></div>
                            <div style={sx("height:6px;border-radius:999px;background:#E7F1ED;overflow:hidden")}><div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px"), width: `${q.score}%` }}></div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {first && (
                <div data-testid="no-history" style={sx("display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:20px;padding:22px;border-radius:16px;border:1px dashed #B8C0CA")}>
                  <span style={sx("width:52px;height:52px;border-radius:50%;border:2.5px solid #0E6B4F;display:flex;align-items:center;justify-content:center;font-family:var(--site-font-display);font-size:18px;font-weight:700;color:#0B1F3A")}>{latest?.score ?? ""}</span>
                  <div style={sx("display:flex;flex-direction:column;gap:4px")}>
                    <span style={sx("font-family:var(--site-font-display);font-size:19px;font-weight:700;color:#0B1F3A")}>Upload a newer statement to start your history</span>
                    <span style={sx("font-size:14px;line-height:1.5;color:#4C5A6E")}>You have one result so far. Each new upload adds a point to this chart, so you can see what changed.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {latest && (latest.coach.working.length > 0 || latest.coach.costing.length > 0) && (
            <div className="ac-span ac-pad" data-testid="coach-notes" style={sx(card + ";gap:18px")}>
              <div style={sx("display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px")}>
                <span style={sx(label12)}>Your coach notes</span>
                <span style={sx("font-size:13px;color:#6B7684")}>{A.notes_compared_with ? `Compared with ${longDate(A.notes_compared_with)}` : "From your first upload"}</span>
              </div>
              <div className="ac-two">
                <div style={sx("display:flex;flex-direction:column;gap:10px")}>
                  <span style={sx("display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1.5px solid #0E6B4F;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F")}>Working for you</span>
                  {latest.coach.working.slice(0, 3).map((n) => (
                    <div key={n.rank} data-testid="note-working" style={sx("display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:16px;background:#E7F1ED")}>
                      {n.tag && <span style={sx("align-self:flex-start;padding:3px 10px;border-radius:999px;background:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#0E6B4F")}>{n.tag}</span>}
                      <span style={sx("font-size:15px;line-height:1.5;font-weight:500;color:#0B1F3A")}>{n.text}</span>
                    </div>
                  ))}
                </div>
                <div style={sx("display:flex;flex-direction:column;gap:10px")}>
                  <span style={sx("display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1.5px solid #A9781F;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7A5A16")}>Costing you</span>
                  {latest.coach.costing.slice(0, 3).map((n) => (
                    <div key={n.rank} data-testid="note-costing" style={sx("display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:16px;background:#F5EBD6")}>
                      {n.tag && <span style={{ ...sx("align-self:flex-start;padding:3px 10px;border-radius:999px;background:#FFFFFF;font-size:11px;font-weight:700;letter-spacing:0.04em"), color: n.tag === "Improved" ? "#0E6B4F" : "#7A5A16" }}>{n.tag}</span>}
                      <span style={sx("font-size:15px;line-height:1.5;font-weight:500;color:#3D2C0B")}>{n.text}</span>
                      {n.action && <span style={sx("padding-top:8px;border-top:1px solid rgba(122,90,22,0.2);font-size:14px;line-height:1.5;font-weight:700;color:#3D2C0B")}>{n.action}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {scored.length > 0 && (
            <div className="ac-span ac-pad" data-testid="reports" style={sx(card + ";gap:6px")}>
              <span style={sx(label12 + ";margin-bottom:8px")}>Past reports</span>
              {scored.map((r) => (
                <div key={r.id} data-testid="report-row" style={sx("display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:16px;padding:10px 0;border-top:1px solid #EEF0F2")}>
                  <div style={sx("display:flex;flex-direction:column;gap:2px;min-width:0")}>
                    <span style={sx("font-size:15px;font-weight:600;color:#0B1F3A")}>{longDate(r.evaluation_date)}</span>
                    <span style={sx("font-size:13px;color:#6B7684")}>{bandLabel(r)}</span>
                  </div>
                  <span style={sx("font-family:var(--site-font-display);font-size:22px;font-weight:700;color:#0B1F3A;font-variant-numeric:tabular-nums")}>{r.score}</span>
                  <a href={pdfHref(r.id)} aria-label={`Download report from ${longDate(r.evaluation_date)}`} className="ac-hover-navy" style={sx("display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;min-width:44px;padding:0 16px;border-radius:999px;border:1px solid #DDE2E7;color:#0B1F3A;font-size:13px;font-weight:600")}><DownloadIcon /><span className="ac-dsk">PDF</span></a>
                </div>
              ))}
            </div>
          )}
        </div>
        <p style={sx("margin:0;max-width:80ch;font-size:13px;line-height:1.6;color:#6B7684")}>{DISCLAIMER}</p>
      </section>
      <div className="ac-mobbar">
        <button type="button" onClick={upload} style={sx("width:100%;height:56px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px")}><UploadIcon />Upload a new statement</button>
      </div>
    </>
  );
}

function Goal({ initial, preview }: { initial: Exclude<GoalState, { state: "none" }>; preview?: { goal?: "change"; kind?: "pillar" | "band" } }) {
  const [g, setG] = useState(initial);
  const [changing, setChanging] = useState(preview?.goal === "change");
  const cur = g.goal;
  const opts = g.options;
  const defPillar = cur.kind === "pillar" && cur.pillar ? cur.pillar : opts.pillars[1]?.key ?? opts.pillars[0].key;
  const [kind, setKind] = useState<"pillar" | "band">(preview?.kind ?? cur.kind);
  const [pillar, setPillar] = useState(defPillar);
  const targets = opts.pillars.find((p) => p.key === pillar)?.targets ?? [];
  const [target, setTarget] = useState<number | null>(null);
  const tgt = target !== null && targets.includes(target) ? target : targets[0];
  const [band, setBand] = useState(cur.kind === "band" && cur.band ? cur.band : opts.bands[opts.bands.length - 1]?.code);
  const [busy, setBusy] = useState(false);

  const post = async (body: unknown) => {
    setBusy(true);
    const res = await fetch("/api/goal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (res?.ok) { setG(await res.json()); setChanging(false); }
  };
  const save = () => post(kind === "pillar" ? { kind, pillar, target: tgt } : { kind, band });
  const open = () => { setKind(cur.kind); setChanging(true); };

  return (
    <div className="ac-pad" data-testid="goal" data-state={changing ? "change" : g.state} style={sx(card + ";gap:14px")}>
      <span style={sx(label12)}>Your goal</span>
      {!changing && (g.state === "auto" || g.state === "active") && (
        <>
          {g.state === "auto" && <span style={sx("align-self:flex-start;display:inline-flex;align-items:center;min-height:26px;padding:3px 10px;border-radius:999px;background:#E6ECF5;font-size:12px;font-weight:700;color:#0B1F3A")}>Set automatically</span>}
          <span style={sx("font-family:var(--site-font-display);font-size:clamp(24px,2.4vw,30px);font-weight:700;letter-spacing:-0.03em;line-height:1.1;color:#0B1F3A")}>{cur.title}</span>
          <div style={sx("display:flex;flex-direction:column;gap:8px")}>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cur.pct} aria-label="Goal progress" style={sx("height:10px;border-radius:999px;background:#E7F1ED;overflow:hidden")}>
              <div style={{ ...sx("height:100%;background:#0E6B4F;border-radius:999px"), width: `${cur.pct}%` }}></div>
            </div>
            <div style={sx("display:flex;justify-content:space-between;font-size:13px;color:#4C5A6E")}>
              <span>{cur.fromLabel}</span><span style={sx("font-weight:700;color:#0B1F3A")}>{cur.nowLabel}</span><span>{cur.toLabel}</span>
            </div>
          </div>
          <p style={sx("margin:0;font-size:14px;line-height:1.5;color:#1C2430")}>{cur.note}</p>
          <button type="button" onClick={open} style={sx("align-self:flex-start;min-height:44px;border:none;background:transparent;padding:0;font-size:14px;font-weight:700;color:#0E6B4F;cursor:pointer")}>Change goal</button>
        </>
      )}
      {changing && (
        <>
          <div role="radiogroup" aria-label="Goal type" style={sx("display:grid;grid-template-columns:1fr 1fr;gap:8px")}>
            {([["pillar", "Raise a pillar", "Pick one pillar and a target"], ["band", "Reach a band", "Aim for the next band overall"]] as const).map(([k, l, help]) => {
              const on = kind === k;
              const off = k === "band" && !opts.bands.length;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => setKind(k)} style={{ ...sx("display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:72px;padding:12px 14px;border-radius:14px;text-align:left;cursor:pointer"), border: `1.5px solid ${on ? "#0E6B4F" : "#DDE2E7"}`, background: on ? "#E7F1ED" : "#FFFFFF", opacity: off ? 0.5 : 1 }}>
                  <span style={sx("font-size:14px;font-weight:700;color:#0B1F3A")}>{l}</span>
                  <span style={sx("font-size:12px;line-height:1.4;color:#4C5A6E")}>{help}</span>
                </button>
              );
            })}
          </div>
          {kind === "pillar" && (
            <div style={sx("display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:10px")}>
              <label style={sx("display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#0B1F3A")}>Pillar
                <select value={pillar} onChange={(e) => { setPillar(e.target.value); setTarget(null); }} style={sx(select)}>
                  {opts.pillars.filter((p) => p.targets.length).map((p) => <option key={p.key} value={p.key}>{p.name} · {p.score}</option>)}
                </select>
              </label>
              <label style={sx("display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#0B1F3A")}>Target
                <select value={String(tgt)} onChange={(e) => setTarget(Number(e.target.value))} style={sx(select)}>
                  {targets.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
          )}
          {kind === "band" && (
            <label style={sx("display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#0B1F3A")}>Band to reach
              <select value={band} onChange={(e) => setBand(e.target.value)} style={sx(select)}>
                {opts.bands.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </label>
          )}
          <div style={sx("display:flex;gap:10px")}>
            <button type="button" onClick={save} disabled={busy} style={sx("height:46px;padding:0 22px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer")}>Save goal</button>
            <button type="button" onClick={() => setChanging(false)} style={sx("height:46px;padding:0 18px;border-radius:999px;border:1px solid #DDE2E7;background:#FFFFFF;color:#0B1F3A;font-size:13px;font-weight:700;cursor:pointer")}>Cancel</button>
          </div>
        </>
      )}
      {!changing && g.state === "reached" && (
        <>
          <div style={sx("display:flex;align-items:center;gap:14px")}>
            <span style={sx("width:48px;height:48px;flex-shrink:0;border-radius:50%;background:#E7F1ED;color:#0E6B4F;display:flex;align-items:center;justify-content:center")}><Check size={22} width="2.4" /></span>
            <span style={sx("font-family:var(--site-font-display);font-size:clamp(22px,2.2vw,26px);font-weight:700;letter-spacing:-0.025em;line-height:1.15;color:#0B1F3A")}>{g.reached.title}</span>
          </div>
          <p style={sx("margin:0;font-size:15px;line-height:1.5;color:#1C2430")}>{g.reached.line}</p>
          <div style={sx("display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:#FAFAF8;border:1px solid #DDE2E7")}>
            <span style={sx(label12)}>Suggested next goal</span>
            <span style={sx("font-size:16px;font-weight:700;color:#0B1F3A")}>{g.next.title}</span>
            <div style={sx("display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center")}>
              <button type="button" onClick={() => post({ accept: true })} disabled={busy} style={sx("height:44px;padding:0 20px;border:none;border-radius:999px;background:#0E6B4F;color:#FFFFFF;font-size:13px;font-weight:700;letter-spacing:0.04em;cursor:pointer")}>Set as my next goal</button>
              <button type="button" onClick={open} style={sx("min-height:44px;border:none;background:transparent;padding:0;font-size:14px;font-weight:700;color:#0E6B4F;cursor:pointer")}>Choose a different goal</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
