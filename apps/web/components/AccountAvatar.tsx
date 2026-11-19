"use client";
import { useEffect, useState } from "react";
import { sx } from "../lib/sx.ts";

// Signed-in visitors on the public pages: the design/account avatar, linking to the
// dashboard. Nothing is shown when signed out.
export function AccountAvatar() {
  const [me, setMe] = useState<{ initials: string } | null>(null);
  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((m) => {
      if (!m?.signed_in) return;
      const parts = String(m.name ?? "").trim().split(/\s+/).filter(Boolean);
      const ini = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) || String(m.email ?? "?")[0];
      setMe({ initials: ini.toUpperCase() });
    }).catch(() => undefined);
  }, []);
  if (!me) return null;
  return (
    <a href="/dashboard" aria-label="Your dashboard" data-testid="account-avatar" style={sx("width:36px;height:36px;flex-shrink:0;border-radius:50%;background:#0B1F3A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 0 0 1px rgba(245,246,244,0.24)")}>{me.initials}</a>
  );
}
