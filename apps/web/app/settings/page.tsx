import { redirect } from "next/navigation";
import { AccountShell } from "../../components/account/Shell.tsx";
import { Settings } from "../../components/account/Settings.tsx";
import { currentAccount } from "../../lib/server/currentAccount.ts";
import { getSettings } from "../../lib/server/accountSettings.ts";
import { initials } from "../../lib/accountView.ts";
import { designPreviewEnabled } from "../../lib/fixtures.ts";
import { PREVIEW_SETTINGS } from "../../lib/accountFixtures.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · The Manager Test, by Beta" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  if (q.preview === "1" && designPreviewEnabled()) {
    return <AccountShell current="settings" initials="KH"><Settings initial={PREVIEW_SETTINGS} preview={{ confirm: q.confirm === "1" }} /></AccountShell>;
  }
  const account = await currentAccount();
  if (!account) redirect("/signin");
  const settings = await getSettings(account.id);
  if (!settings) redirect("/signin");
  return <AccountShell current="settings" initials={initials(account.name, account.email)}><Settings initial={settings} /></AccountShell>;
}
