"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectNavItem = {
  href: string;
  label: string;
};

export function ProjectNav({ items }: { items: ProjectNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-6 space-y-1 px-1">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`senda-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
              active
                ? "bg-[var(--navy)] font-medium text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#61ddcf]" : "bg-zinc-300"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
