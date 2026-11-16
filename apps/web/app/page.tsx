import ManagerTest, { type Initial } from "../components/ManagerTest.tsx";
import { DESIGN_FIXTURES, designPreviewEnabled } from "../lib/fixtures.ts";
import type { ErrKey } from "../lib/types.ts";

type Search = Promise<Record<string, string | string[] | undefined>>;

// In development only, the design's URL parameters (screen, err, flags, tab, step, form)
// render a state with the design's sample data, for side-by-side checks against design/.
function previewState(q: Record<string, string | undefined>): Initial {
  const screen = q.screen;
  if (screen === "analyzing") return { screen: "analyzing", step: Number(q.step ?? 1) };
  if (screen === "error") return { screen: "error", err: (q.err as ErrKey) || "mt4" };
  if (screen === "results") {
    return {
      screen: "results",
      result: DESIGN_FIXTURES[q.flags === "warn" ? "warn" : "results"],
      ...(q.form === "errors" ? { form: { name: "", email: "karim@", phone: "3 12" }, formErrors: true } : {}),
    };
  }
  if (screen === "short") return { screen: "results", result: DESIGN_FIXTURES.short };
  return { tab: q.tab === "mobile" ? "mobile" : "desktop" };
}

export default async function Page({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const q = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const initial = designPreviewEnabled() ? previewState(q) : {};
  return <ManagerTest initial={initial} />;
}
