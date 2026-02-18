import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "PantryPilot",
  description: "Pantry management and recipe generation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen max-w-4xl px-4 py-8">
          <header className="mb-6 flex flex-col gap-3 rounded-xl bg-brand-500 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-2xl font-bold" href="/pantry">
              PantryPilot
            </Link>
            <Nav />
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
