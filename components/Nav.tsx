"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/pantry", label: "Pantry" },
  { href: "/generate", label: "Generate" },
  { href: "/recipes", label: "Recipes" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl bg-emerald-950/20 p-1.5 ring-1 ring-white/20">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            className={`nav-chip ${
              active ? "nav-chip-active" : "nav-chip-idle"
            }`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
