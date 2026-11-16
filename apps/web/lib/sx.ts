import type { CSSProperties } from "react";

// Turns a design inline-style string ("display:flex;gap:8px") into a React style
// object, so component markup can carry the design's styles verbatim.
const cache = new Map<string, CSSProperties>();

export function sx(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = value;
  }
  cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}
