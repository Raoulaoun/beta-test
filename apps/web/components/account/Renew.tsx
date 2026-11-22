"use client";
import { useEffect } from "react";

// A visit to a signed-in page renews the year-long session (the server does it at most once a day).
export function RenewSession() {
  useEffect(() => { fetch("/api/me").then((r) => r.text()).catch(() => undefined); }, []); // read the body: the request then completes
  return null;
}
