"use client";

// Segmented control that switches which section of the page is visible.
// URL-param driven so the active tab persists in the browser history
// and survives reloads + can be linked-to. Modelled on
// `<GranularityPicker>`. Reused on every dashboard's tab strip.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useReportTransition } from "@/lib/nav-progress-context";
import { cn } from "@/lib/utils";
import type { ViewTabOption } from "@/lib/view-tabs";

export type { ViewTabOption };

export function ViewTabs({
  pathname,
  paramName = "view",
  value,
  options,
  className,
}: {
  pathname: string;
  paramName?: string;
  value: string;
  options: ViewTabOption[];
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);

  const pick = (next: string) => {
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
      aria-label="View"
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
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
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

// parseViewTab now lives in `lib/view-tabs.ts` so server pages can import
// it without Next 16 treating it as a client-only function. Import from
// `@/lib/view-tabs` directly in your server pages.
