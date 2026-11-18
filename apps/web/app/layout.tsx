import type { Metadata, Viewport } from "next";
import { isProductionSite } from "../lib/site.ts";
import "./design.css";
import "./app.css";

export const metadata: Metadata = {
  title: "The Manager Test, by Beta",
  description: "Are you ready to manage other people's money? Upload your MT4 or MT5 statement and find out in 60 seconds. Free.",
  robots: isProductionSite() ? undefined : { index: false, follow: false },
};

// resizes-content: on Android the layout shrinks with the keyboard, so the form sheet's
// fields stay above it (iOS is handled in FormModal through the visual viewport).
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
