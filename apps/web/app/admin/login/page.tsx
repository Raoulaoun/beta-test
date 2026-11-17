import type { Metadata } from "next";
import { AdminLogin } from "../../../components/admin/Login.tsx";

export const metadata: Metadata = { title: "Manager Test · Admin", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <AdminLogin />;
}
