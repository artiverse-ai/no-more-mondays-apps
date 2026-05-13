"use client";

// Segmented control for time-axis granularity. URL-param driven so server
// pages can rollup daily rows server-side. Reused across the Webinar,
// CEO, Sales, and Setter dashboards.
//
// Types + option arrays + the parser live in lib/granularity.ts so
// server pages can import them without crossing the RSC boundary.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type {
  Granularity,
  GranularityOption,
} from "@/lib/granularity";

export type { Granularity, GranularityOption };
// Re-exports for ergonomic call sites — both server and client.
export {
  GRANS_TIME,
  GRANS_WEBINAR,
  parseGranularity,
} from "@/lib/granularity";

export function GranularityPicker({
  pathname,
  value,
  options,
  paramName = "gran",
  className,
}: {
  pathname: string;
  value: Granularity;
  options: GranularityOption[];
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
