import { redirect } from "next/navigation";
import { AccountShell } from "../../components/account/Shell.tsx";
import { Dashboard } from "../../components/account/Dashboard.tsx";
import { currentAccount } from "../../lib/server/currentAccount.ts";
import { dashboard } from "../../lib/server/dashboard.ts";
import { initials } from "../../lib/accountView.ts";
import { designPreviewEnabled } from "../../lib/fixtures.ts";
import { previewDashboard } from "../../lib/accountFixtures.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your dashboard · The Manager Test, by Beta" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  if (q.preview === "1" && designPreviewEnabled()) {
    const p = previewDashboard(q);
    return <AccountShell current="dashboard" initials="KH"><Dashboard data={p.data} preview={p.preview} /></AccountShell>;
  }
  const account = await currentAccount();
  if (!account) redirect("/signin");
  const data = await dashboard(account.id);
  return (
    <AccountShell current="dashboard" initials={initials(account.name, account.email)}>
      <Dashboard data={{ name: account.name, ...data } as never} />
    </AccountShell>
  );
}
