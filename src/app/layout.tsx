import type { Metadata, Viewport } from "next";
import "@fontsource-variable/hubot-sans/wdth.css";
import "@fontsource-variable/mona-sans/wdth.css";
import "@fontsource-variable/alexandria";
import "./globals.css";

export const metadata: Metadata = {
  title: "rply — the reply layer for brands that sell in the comments",
  description: "AI replies to Facebook and Instagram comments and DMs, in your voice.",
};
export const viewport: Viewport = { themeColor: "#f2f2f0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
