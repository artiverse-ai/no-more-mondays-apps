"use client";

// Segmented control for time-axis granularity. URL-param driven so server
// pages can rollup daily rows server-side. Reused across the Webinar,
// CEO, Sales, and Setter dashboards in later phases.
//
// Each dashboard supplies its own list of valid options because the
// granularities differ:
//   - CEO / Sales / Setter:  day  / week / month / year
//   - Webinar:                webinar / week / month / year
//                             (webinars don't happen daily — one bar per event)

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export type Granularity = "day" | "webinar" | "week" | "month" | "year";

export type GranularityOption = { key: Granularity; label: string };

export function GranularityPicker({
  pathname,
  value,
  options,
  paramName = "gran",
  className,
}: {
  /** Path to push to (e.g. "/dashboards/webinar"). */
  pathname: string;
  /** Currently-selected granularity. */
  value: Granularity;
  /** Granularities allowed on this route, left → right. */
  options: GranularityOption[];
  /** URL param name. Default `gran`. */
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const pick = (next: Granularity) => {
    if (next === value) return;
    const sp = new URLSearchParams(params);
    sp.set(paramName, next);
    startTransition(() =>
      router.push(`${pathname}?${sp.toString()}`, { scroll: false }),
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Granularity"
      data-pending={pending ? "" : undefined}
      className={cn(
        "inline-flex rounded-xl border border-border bg-background p-1 shadow-sm data-[pending]:opacity-70 data-[pending]:transition-opacity",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => pick(opt.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Default option sets for each dashboard. */
export const GRANS_TIME: GranularityOption[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export const GRANS_WEBINAR: GranularityOption[] = [
  { key: "webinar", label: "Webinar" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** Validate `?gran=` value against an allowed set; default if invalid. */
export function parseGranularity(
  raw: string | string[] | undefined,
  allowed: GranularityOption[],
  fallback: Granularity,
): Granularity {
  const v = typeof raw === "string" ? raw : "";
  return allowed.some((o) => o.key === v) ? (v as Granularity) : fallback;
}
