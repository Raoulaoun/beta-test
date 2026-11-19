// The signed-in account for a server page (session cookie), or null.
import { headers } from "next/headers";
import { sessionAccount } from "./session.ts";

export async function currentAccount() {
  return sessionAccount((await headers()).get("cookie")).catch(() => null);
}
