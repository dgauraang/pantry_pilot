import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "PantryPilot",
  description: "Pantry management and recipe generation"
};

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <div className="bg-orb bg-orb-left" aria-hidden />
        <div className="bg-orb bg-orb-right" aria-hidden />
        <main className="relative z-10 mx-auto min-h-screen max-w-5xl px-4 py-8">
          <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-brand-700 to-brand-500 p-5 text-white shadow-lg shadow-emerald-900/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link className="brand-mark text-3xl font-bold tracking-tight" href="/pantry">
                PantryPilot
              </Link>
              <p className="mt-1 text-sm text-emerald-50/90">Cook smarter from what you already have.</p>
            </div>
            <Nav />
          </header>
          <section className="page-shell">{children}</section>
        </main>
      </body>
    </html>
  );
}
