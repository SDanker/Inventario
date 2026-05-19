"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

export function Sidebar({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 border-r border-slate-200 bg-white">
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-500">SIIB</div>
        <div className="text-lg font-bold text-brand-700">{title}</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
