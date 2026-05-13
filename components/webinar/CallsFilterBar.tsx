"use client";

// Drill-in filter bar for the calls table on /dashboards/webinar/[date].
// URL-param driven (?closer=, ?setter=, ?flow=, ?status=) so the server
// can filter and render — no client-side state to keep in sync. Active
// filters show as chips with a one-click clear; "Reset all" clears
// every filter in one go.

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusFilter =
  | "all"
  | "deal"
  | "deposit"
  | "showed"
  | "setter-dq"
  | "closer-dq"
  | "none";

const STATUSES: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "deal", label: "Deal" },
  { key: "deposit", label: "Deposit" },
  { key: "showed", label: "Showed" },
  { key: "setter-dq", label: "Setter DQ" },
  { key: "closer-dq", label: "Closer DQ" },
  { key: "none", label: "No-show / Other" },
];

const CTRL =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-foreground/40 focus:border-ring focus:outline-none";

export function CallsFilterBar({
  closer,
  setter,
  flow,
  status,
  closers,
  setters,
  flows,
  filteredCount,
  totalCount,
  webinarDate,
}: {
  closer: string;
  setter: string;
  flow: string;
  status: StatusFilter;
  closers: string[];
  setters: string[];
  flows: string[];
  filteredCount: number;
  totalCount: number;
  webinarDate: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    const q = next.toString();
    startTransition(() =>
      router.push(
        q ? `/dashboards/webinar/${webinarDate}?${q}` : `/dashboards/webinar/${webinarDate}`,
        { scroll: false },
      ),
    );
  };

  const hasAny = Boolean(closer || setter || flow || (status && status !== "all"));

  const shortEmail = (e: string) => (e.includes("@") ? e.split("@")[0] : e);

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Filter calls
        </span>
        <span className="text-[11px] text-muted-foreground">
          {filteredCount} of {totalCount}
        </span>
        {pending ? (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            updating
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Status — segmented */}
        <div
          role="tablist"
          aria-label="Status"
          className="inline-flex flex-wrap rounded-xl border border-border bg-background p-1"
        >
          {STATUSES.map((s) => {
            const active = status === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => apply({ status: s.key })}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{ transitionTimingFunction: "var(--ease-out)" }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Closer */}
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Closer
          </span>
          <select
            value={closer}
            onChange={(e) => apply({ closer: e.target.value })}
            className={CTRL}
          >
            <option value="">All</option>
            {closers.map((c) => (
              <option key={c} value={c}>
                {shortEmail(c)}
              </option>
            ))}
          </select>
        </label>

        {/* Setter */}
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Setter
          </span>
          <select
            value={setter}
            onChange={(e) => apply({ setter: e.target.value })}
            className={CTRL}
          >
            <option value="">All</option>
            {setters.map((s) => (
              <option key={s} value={s}>
                {shortEmail(s)}
              </option>
            ))}
          </select>
        </label>

        {/* Flow */}
        <label className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Flow
          </span>
          <select
            value={flow}
            onChange={(e) => apply({ flow: e.target.value })}
            className={CTRL}
          >
            <option value="">All</option>
            {flows.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        {hasAny ? (
          <button
            type="button"
            onClick={() =>
              apply({ closer: null, setter: null, flow: null, status: null })
            }
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-3 w-3" /> Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
