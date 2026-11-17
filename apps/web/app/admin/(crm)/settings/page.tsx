import { sx } from "../../../../lib/sx.ts";
import { getLinks } from "../../../../lib/server/settings.ts";
import { SettingsForm } from "../../../../components/admin/SettingsForm.tsx";
import { h1 } from "../../../../components/admin/ui.tsx";

export default async function SettingsPage() {
  return (
    <>
      <div><h1 style={sx(h1)}>Settings</h1><p style={sx("margin:6px 0 0;font-size:14px;color:#6B7684")}>Changes apply right away, without a deploy.</p></div>
      <SettingsForm initial={await getLinks()} />
    </>
  );
}
