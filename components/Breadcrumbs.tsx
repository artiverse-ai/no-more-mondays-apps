"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Human-readable labels for known path segments. Unknown or dynamic segments
// fall back to a prettified version of the raw value (ISO dates, emails, slugs).
const SEGMENT_LABELS: Record<string, string> = {
  apps: "Apps",
  calendar: "Calendar Capacity",
  team: "Team",
  "calendly-search": "Calendly Note Search",
  dashboards: "Dashboards",
  webinar: "Webinar Performance",
  "high-level": "High-Level",
  sales: "Sales Performance",
  setter: "Setter Performance",
  "weekly-report": "Weekly Report",
  admin: "Admin",
  access: "Site access",
  closers: "Closers",
  sops: "SOPs",
  "how-to-read-capacity-dashboard": "How to read the capacity dashboard",
  "closer-calendar-management": "Calendar management for closers",
  "new-closer-joins": "When a new closer joins",
  "closer-removed": "When a closer is removed",
};

// Paths that appear in the URL hierarchy but have no page of their own —
// render them as plain text instead of links.
const NON_NAVIGABLE = new Set(["/apps", "/dashboards", "/apps/calendar/team"]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function labelFor(segment: string): string {
  const value = decodeURIComponent(segment);
  if (SEGMENT_LABELS[value]) return SEGMENT_LABELS[value];
  if (ISO_DATE.test(value)) {
    return new Date(value + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
  if (value.includes("@")) return value; // emails verbatim
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs({
  rightSlot,
}: {
  /** Optional content rendered on the right side of the bar (e.g. dark-mode toggle). */
  rightSlot?: React.ReactNode;
} = {}) {
  const pathname = usePathname() ?? "/";

  // On `/` we still show the bar (brand + rightSlot) so the dark-mode
  // toggle is reachable from the launcher. Crumbs are empty.
  const isHome = pathname === "/";

  const segments = isHome ? [] : pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isCurrent = i === segments.length - 1;
    return {
      key: href,
      label: labelFor(segment),
      href,
      isCurrent,
      isLink: !isCurrent && !NON_NAVIGABLE.has(href),
    };
  });

  return (
    <header className="border-b border-border bg-card">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 py-2.5 text-sm md:px-8 lg:px-10"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-heading font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
        >
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-md bg-accent text-[11px] font-bold leading-none text-accent-foreground"
          >
            N
          </span>
          <span className="hidden sm:inline">No More Mondays</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
          {crumbs.map((crumb) => (
            <span key={crumb.key} className="flex shrink-0 items-center gap-2">
              <span aria-hidden className="text-muted-foreground/50">
                /
              </span>
              {crumb.isCurrent ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : crumb.isLink ? (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
        {rightSlot ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {rightSlot}
          </div>
        ) : null}
      </nav>
    </header>
  );
}
