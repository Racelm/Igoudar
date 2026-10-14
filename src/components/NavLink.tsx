"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${
        active ? "bg-glow-soft text-ink shadow-[inset_0_0_0_1px_var(--glow)]" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
