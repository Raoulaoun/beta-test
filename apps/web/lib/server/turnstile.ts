// Cloudflare Turnstile check for the lead form. With no secret configured it is skipped,
// except on the production site, where a missing secret refuses the form.
import { isProductionSite } from "../site.ts";

export async function verifyTurnstile(token: string | undefined, ip: string | null): Promise<"ok" | "failed" | "misconfigured"> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return isProductionSite() ? "misconfigured" : "ok";
  if (!token) return "failed";
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body, signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
