// Values the team can change in /admin without a deploy.
import { db, schema as s } from "../db/index.ts";

export const SETTING_KEYS = ["link_webinar", "link_managers_room", "link_beta"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type Links = Record<SettingKey, string>;

export const DEFAULT_LINKS: Links = { link_webinar: "", link_managers_room: "", link_beta: "https://betaapp.me" };

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
    if (!validLink(value)) throw new Error(`invalid link: ${key}`);
    await db().insert(s.siteSettings).values({ key, value, updatedBy: by })
      .onConflictDoUpdate({ target: s.siteSettings.key, set: { value, updatedBy: by, updatedAt: new Date() } });
  }
}
