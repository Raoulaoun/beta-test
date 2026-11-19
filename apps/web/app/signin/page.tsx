import { redirect } from "next/navigation";
import { AccountShell } from "../../components/account/Shell.tsx";
import { SignIn } from "../../components/account/SignIn.tsx";
import { currentAccount } from "../../lib/server/currentAccount.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · The Manager Test, by Beta" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await currentAccount()) redirect("/dashboard");
  const q = await searchParams;
  return <AccountShell><SignIn initial={q.expired === "1" ? "expired" : "signin"} /></AccountShell>;
}
