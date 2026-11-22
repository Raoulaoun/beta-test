"use client";
import { useEffect, useState } from "react";
import { sx } from "../lib/sx.ts";

// Public headers (design/flow): signed out, an outlined "Sign in" link; signed in, the
// initials avatar linking to the dashboard. `dark`: the landing hero (light avatar);
// otherwise the light app header (navy avatar). Nothing shows until /api/me answers.
type Me = { signedIn: false } | { signedIn: true; initials: string; name: string };

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener("mt:signed-in", again);
    return () => window.removeEventListener("mt:signed-in", again);
  }, []);
  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((m) => {
      if (!m?.signed_in) { setMe({ signedIn: false }); return; }
      const name = String(m.name ?? "").trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const ini = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || String(m.email ?? "?")[0];
      setMe({ signedIn: true, initials: ini.toUpperCase(), name: name || String(m.email ?? "") });
    }).catch(() => setMe({ signedIn: false }));
  }, [tick]);
  return me;
}

export function AccountAvatar({ dark = false }: { dark?: boolean }) {
  const me = useMe();
  if (!me) return <span aria-hidden="true" style={sx("width:44px;height:44px")}></span>;
  if (!me.signedIn) {
    return (
      <a href="/signin" data-testid="header-signin" className={dark ? "ac-hover-light" : "mt-hover-border"}
        style={sx(`display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;font-size:13px;font-weight:600;white-space:nowrap;${dark ? "border:1px solid rgba(245,246,244,0.35);color:#F5F6F4" : "border:1px solid #DDE2E7;color:#0B1F3A"}`)}>Sign in</a>
    );
  }
  return (
    <a href="/dashboard" aria-label={`Your dashboard, ${me.name}`} data-testid="account-avatar" style={sx("width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%")}>
      <span style={sx(`width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;${dark ? "background:#F5F6F4;color:#0B1F3A" : "background:#0B1F3A;color:#FFFFFF"}`)}>{me.initials}</span>
    </a>
  );
}
