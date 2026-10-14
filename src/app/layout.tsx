import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const heading = Unbounded({ subsets: ["latin"], variable: "--font-heading", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Igoudar", template: "%s · Igoudar" },
  description: "Rechnungen, Verträge und gespeicherte Seiten an einem sicheren Ort.",
};

export const viewport: Viewport = { themeColor: "#0e1130" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
