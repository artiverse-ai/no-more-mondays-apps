"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReportTransition } from "@/lib/nav-progress-context";
import { eraLabel } from "./format";

const CONTROL_CLS =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-foreground/40 focus:border-ring focus:outline-none";

export function WebinarFilters({
  days,
  eras,
  day,
  era,
  from,
  to,
}: {
  days: string[];
  eras: string[];
  day: string;
  era: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);

  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() =>
      router.push(`/dashboards/webinar?${next.toString()}`, { scroll: false }),
    );
  };

  const hasFilters = Boolean(day || era || from || to);

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="flex flex-wrap items-end gap-4 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <Field label="Webinar day">
        <select
          value={day || "all"}
          onChange={(e) => apply({ day: e.target.value })}
          className={CONTROL_CLS}
        >
          <option value="all">All</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Era">
        <select
          value={era || "all"}
          onChange={(e) => apply({ era: e.target.value })}
          className={CONTROL_CLS}
        >
          <option value="all">All</option>
          {eras.map((e) => (
            <option key={e} value={e}>
              {eraLabel(e)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="From">
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => apply({ from: e.target.value })}
          className={CONTROL_CLS}
        />
      </Field>

      <Field label="To">
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => apply({ to: e.target.value })}
          className={CONTROL_CLS}
        />
      </Field>

      <button
        type="button"
        onClick={() => apply({ day: null, era: null, from: null, to: null })}
        disabled={!hasFilters}
        className="ml-auto self-end text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
      >
        Reset
      </button>

      {pending ? (
        <span className="inline-flex items-center gap-2 self-end text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          updating
        </span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
