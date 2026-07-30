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
    <nav className="mt-4 space-y-1">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-md px-3 py-2 text-sm ${
              active
                ? "bg-zinc-950 font-medium text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
