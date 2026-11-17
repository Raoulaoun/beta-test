// Shared admin pieces, from design/admin (colors, chips, cards).
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { sx } from "../../lib/sx.ts";

export function scoreColors(score: number | null): [string, string] {
  if (score === null) return ["#EEF0F2", "#4C5A6E"];
  return score >= 80 ? ["#0B1F3A", "#FFFFFF"] : score >= 60 ? ["#E7F1ED", "#0E6B4F"] : score >= 40 ? ["#F5EBD6", "#7A5A16"] : ["#EEF0F2", "#4C5A6E"];
}

const STAGE_COLORS: Record<string, [string, string]> = {
  new: ["#E6ECF5", "#0B1F3A"], contacted: ["#EEF0F2", "#1C2430"], webinar_registered: ["#E7F1ED", "#0E6B4F"],
  webinar_attended: ["#D3E8DE", "#0B5A42"], applied: ["#0E6B4F", "#FFFFFF"], not_a_fit: ["#F3F4F2", "#6B7684"],
};
export const stageColors = (code: string): [string, string] => STAGE_COLORS[code] ?? STAGE_COLORS.new;

export function ScoreChip({ score, small }: { score: number | null; small?: boolean }) {
  const [bg, fg] = scoreColors(score);
  return <span style={{ ...sx(small ? "display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:22px;border-radius:6px;font-weight:700" : "display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:28px;border-radius:8px;font-weight:700;font-variant-numeric:tabular-nums"), background: bg, color: fg }}>{score ?? "—"}</span>;
}

export const card = "border-radius:16px;background:#FFFFFF;border:1px solid #DDE2E7";
export const th = "padding:12px 10px;font-weight:700";
export const theadRow = "background:#FAFAF8;text-align:left;color:#4C5A6E;font-size:11px;letter-spacing:0.06em;text-transform:uppercase";
export const h1 = "margin:0;font-family:var(--site-font-display);font-size:30px;font-weight:700;letter-spacing:-0.03em;color:#0B1F3A";
export const label = "display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#4C5A6E";
export const select = "height:40px;padding:0 10px;border-radius:10px;border:1px solid #DDE2E7;background:#FFFFFF;font-size:14px;color:#0B1F3A";

export function fmtDate(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Beirut" });
}

export function waLink(phone: string | null, name: string | null, adminName: string): string | null {
  if (!phone) return null;
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const text = `Hi ${first}, this is ${adminName} from Beta. Thanks for taking the Manager Test.`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

export function fmtPhone(e164: string | null): string {
  if (!e164) return "—";
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
