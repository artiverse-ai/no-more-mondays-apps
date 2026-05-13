"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PeriodKey } from "@/lib/highLevel";

const QUICK: Array<{ key: PeriodKey; label: string }> = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
  { key: "ytd", label: "YTD" },
  { key: "custom", label: "Custom" },
];

const CONTROL_CLS =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-foreground/40 focus:border-ring focus:outline-none";

export function PeriodFilter({
  period,
  from,
  to,
}: {
  period: PeriodKey;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    startTransition(() =>
      router.push(`/dashboards/high-level?${next.toString()}`, { scroll: false }),
    );
  };

  const pick = (key: PeriodKey) => {
    if (key === "custom") {
      apply({ period: "custom", from, to });
    } else {
      apply({ period: key, from: null, to: null });
    }
  };

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="space-y-4 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Period
        </span>
        <div
          role="tablist"
          aria-label="Period"
          className="inline-flex rounded-xl border border-border bg-background p-1"
        >
          {QUICK.map((q) => {
            const active = period === q.key;
            return (
              <button
                key={q.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pick(q.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>
        {pending ? (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            updating
          </span>
        ) : null}
      </div>

      {period === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              From
            </span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) =>
                apply({ period: "custom", from: e.target.value, to })
              }
              className={CONTROL_CLS}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              To
            </span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) =>
                apply({ period: "custom", from, to: e.target.value })
              }
              className={CONTROL_CLS}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
