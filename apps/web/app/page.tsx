import ManagerTest, { type Initial } from "../components/ManagerTest.tsx";
import { DESIGN_FIXTURES, designPreviewEnabled, withNudge } from "../lib/fixtures.ts";
import { getLinks, DEFAULT_LINKS } from "../lib/server/settings.ts";
import type { ErrKey } from "../lib/types.ts";

type Search = Promise<Record<string, string | string[] | undefined>>;

// In development only, the design's URL parameters (screen, err, flags, tab, step, form)
// render a state with the design's sample data, for side-by-side checks against design/.
function previewState(q: Record<string, string | undefined>): Initial {
  const screen = q.screen;
  if (!screen && !q.tab) return {};
  const p = { preview: true };
  if (screen === "sent") return { ...p, screen: "sent", sentTo: "karim@example.com" };
  if (screen === "analyzing") return { ...p, screen: "analyzing", step: Number(q.step ?? 1) };
  if (screen === "error") return { ...p, screen: "error", err: (q.err as ErrKey) || "notstatement" };
  if (screen === "results" || screen === "short") {
    // type = full (default) | early | starter; screen=short is the design's old frame, now early.
    const type = screen === "short" ? "early" : q.type || "full";
    const base = type === "early" ? DESIGN_FIXTURES.early : type === "starter" ? DESIGN_FIXTURES.starter
      : DESIGN_FIXTURES[q.flags === "warn" ? "warn" : "results"];
    const r = q.nudge === "1" ? withNudge(base) : base;
    return {
      ...p,
      screen: "results",
      exitOpen: q.exit === "1",
      ...(q.modal === "1" ? { formOpen: "results_button" as const } : {}),
      result: q.signedin === "1" ? { ...r, saved_to_account: true } : r,
      ...(q.form === "errors" ? { form: { name: "", email: "karim@", phone: "3 12" }, formErrors: true } : {}),
    };
  }
  return { ...p, tab: q.tab === "mobile" ? "mobile" : q.tab === "mt4" ? "mt4" : "desktop" };
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const q = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const preview = designPreviewEnabled() ? previewState(q) : {};
  const links = preview.preview ? { ...DEFAULT_LINKS, link_webinar: "https://example.com/webinar", link_managers_room: "https://t.me/example" } : await getLinks();
  return <ManagerTest initial={preview} links={links} />;
}
