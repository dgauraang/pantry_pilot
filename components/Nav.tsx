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
    <nav className="flex gap-3">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-brand-700 text-white" : "bg-white text-slate-700"
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
