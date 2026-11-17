"use client";
import { sx } from "../../lib/sx.ts";

export function SignOut() {
  return (
    <button type="button" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); window.location.href = "/admin/login"; }}
      style={sx("align-self:flex-start;border:none;background:transparent;padding:0;font-size:12px;font-weight:600;color:#C3CBD5;cursor:pointer")}>Sign out</button>
  );
}
