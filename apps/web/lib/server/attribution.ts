// Where a visitor came from: UTM tags, introducer ref code, device. No personal data.

export type Attribution = { campaign: string | null; utm: Record<string, string>; introducedBy: string | null };

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function attributionFrom(params: URLSearchParams): Attribution {
  const utm: Record<string, string> = {};
  for (const k of UTM) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 120);
  }
  const ref = params.get("ref");
  return {
    campaign: utm.utm_campaign || (utm.utm_source ? utm.utm_source : null),
    utm,
    introducedBy: ref ? ref.replace(/[^\w-]/g, "").slice(0, 40) || null : null,
  };
}

export function deviceFrom(userAgent: string | null): string {
  const ua = userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  return "Desktop";
}
