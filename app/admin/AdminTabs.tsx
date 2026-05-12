"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
};

const TABS: Tab[] = [
  { href: "/admin/closers", label: "Closers" },
  { href: "/admin/access", label: "Site access" },
];

export function AdminTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      role="tablist"
      aria-label="Admin sections"
      className="-mb-px flex gap-1 overflow-x-auto border-b border-border"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={
              "relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors " +
              (active
                ? "border-b-2 border-accent text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
