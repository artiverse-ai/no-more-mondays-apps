"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  description: string;
};

const TABS: Tab[] = [
  {
    href: "/admin/closers",
    label: "Closers",
    description: "Active roster for the booking dashboard.",
  },
  {
    href: "/admin/access",
    label: "Site access",
    description: "Emails allowed to sign into this site.",
  },
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

export function TabDescription({ href }: { href: string }) {
  const tab = TABS.find((t) => t.href === href);
  if (!tab) return null;
  return <p className="text-sm text-muted-foreground">{tab.description}</p>;
}
