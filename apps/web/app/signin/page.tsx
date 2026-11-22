import { redirect } from "next/navigation";
import { AccountShell } from "../../components/account/Shell.tsx";
import { SignIn } from "../../components/account/SignIn.tsx";
import { SignedOut } from "../../components/account/Menu.tsx";
import { currentAccount } from "../../lib/server/currentAccount.ts";
import { sx } from "../../lib/sx.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · The Manager Test, by Beta" };

// design/account: view=signin (the code sign-in) and view=signedout (after Sign out).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  if (q.signedout === "1") return <AccountShell><SignedOut /></AccountShell>;
  if (await currentAccount()) redirect("/dashboard");
  return (
    <AccountShell>
      <section className="ac-wrap" style={sx("padding-top:clamp(40px,9vw,112px);padding-bottom:clamp(56px,9vw,120px);display:flex;justify-content:center")}>
        <div style={sx("width:100%;max-width:480px")}><SignIn /></div>
      </section>
    </AccountShell>
  );
}
