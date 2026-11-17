import ManagerTest, { type Initial } from "../components/ManagerTest.tsx";
import { DESIGN_FIXTURES, designPreviewEnabled, withNudge } from "../lib/fixtures.ts";
import type { ErrKey } from "../lib/types.ts";

type Search = Promise<Record<string, string | string[] | undefined>>;

// In development only, the design's URL parameters (screen, err, flags, tab, step, form)
// render a state with the design's sample data, for side-by-side checks against design/.
function previewState(q: Record<string, string | undefined>): Initial {
  const screen = q.screen;
  if (screen === "analyzing") return { screen: "analyzing", step: Number(q.step ?? 1) };
  if (screen === "error") return { screen: "error", err: (q.err as ErrKey) || "notstatement" };
  if (screen === "results" || screen === "short") {
    // type = full (default) | early | starter; screen=short is the design's old frame, now early.
    const type = screen === "short" ? "early" : q.type || "full";
    const base = type === "early" ? DESIGN_FIXTURES.early : type === "starter" ? DESIGN_FIXTURES.starter
      : DESIGN_FIXTURES[q.flags === "warn" ? "warn" : "results"];
    return {
      screen: "results",
      result: q.nudge === "1" ? withNudge(base) : base,
      ...(q.form === "errors" ? { form: { name: "", email: "karim@", phone: "3 12" }, formErrors: true } : {}),
    };
  }
  return { tab: q.tab === "mobile" ? "mobile" : q.tab === "mt4" ? "mt4" : "desktop" };
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const q = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const initial = designPreviewEnabled() ? previewState(q) : {};
  return <ManagerTest initial={initial} />;
}
