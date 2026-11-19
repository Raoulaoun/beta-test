// Values the team can change in /admin without a deploy.
import { db, schema as s } from "../db/index.ts";

// webinar_when: the next webinar's date and time as shown in the PDF's Next step page
// (e.g. "Thursday 26 November · 8:00 PM Beirut"); plain text, empty hides the line.
export const SETTING_KEYS = ["link_webinar", "link_managers_room", "link_beta", "webinar_when"] as const;
export const TEXT_KEYS: readonly SettingKey[] = ["webinar_when"];
export type SettingKey = (typeof SETTING_KEYS)[number];
export type Links = Record<SettingKey, string>;

export const DEFAULT_LINKS: Links = { link_webinar: "", link_managers_room: "", link_beta: "https://betaapp.me", webinar_when: "" };

export function validSetting(key: SettingKey, v: string): boolean {
  return TEXT_KEYS.includes(key) ? v.length <= 80 && !/[<>]/.test(v) : validLink(v);
}

export async function getLinks(): Promise<Links> {
  try {
    const rows = await db().select().from(s.siteSettings);
    const out = { ...DEFAULT_LINKS };
    for (const r of rows) if ((SETTING_KEYS as readonly string[]).includes(r.key)) out[r.key as SettingKey] = r.value;
    return out;
  } catch {
    return { ...DEFAULT_LINKS };
  }
}

export function validLink(v: string): boolean {
  if (v === "") return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function setLinks(values: Partial<Links>, by: string): Promise<void> {
  for (const key of SETTING_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    if (!validSetting(key, value)) throw new Error(`invalid setting: ${key}`);
    await db().insert(s.siteSettings).values({ key, value, updatedBy: by })
      .onConflictDoUpdate({ target: s.siteSettings.key, set: { value, updatedBy: by, updatedAt: new Date() } });
  }
}
