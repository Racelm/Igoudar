import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: { default: "Igoudar", template: "%s · Igoudar" },
  description: "Rechnungen, Verträge und gespeicherte Seiten an einem sicheren Ort.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${body.variable} ${heading.variable}`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
