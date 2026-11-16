import type { Metadata, Viewport } from "next";
import "./design.css";
import "./app.css";

export const metadata: Metadata = {
  title: "The Manager Test, by Beta",
  description: "Are you ready to manage other people's money? Upload your MT5 statement and find out in 60 seconds. Free.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
