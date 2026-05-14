"use client";

// Cross-filter row for the rebuilt /dashboards/sales (and /setter)
// dashboard. URL-driven. Six dimensions + a free-text email search +
// "Reset all" pill. Filter options come from the FULL un-filtered rowset
// so chips don't disappear as other filters narrow the visible data.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { useReportTransition } from "@/lib/nav-progress-context";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "@/lib/calls";

type Props = {
  pathname: string;
  options: FilterOptions;
  source: string;
  closer: string;
  setter: string;
  triage: string;
  callOutcome: string;
  occFuc: string;
  emailLike: string;
};

const CTRL =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-foreground/40 focus:border-ring focus:outline-none";

const shortEmail = (e: string) => (e.includes("@") ? e.split("@")[0] : e);

export function CallsFilterRow({
  pathname,
  options,
  source,
  closer,
  setter,
  triage,
  callOutcome,
  occFuc,
  emailLike,
}: Props) {
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
      router.push(`${pathname}?${next.toString()}`, { scroll: false }),
    );
  };

  const reset = () =>
    apply({
      source: null,
      closer: null,
      setter: null,
      triage: null,
      callOutcome: null,
      occFuc: null,
      email: null,
    });

  const hasAny =
    !!(source || closer || setter || triage || callOutcome || occFuc || emailLike);

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[var(--shadow-card)] data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <Select
        label="Source"
        value={source}
        onChange={(v) => apply({ source: v })}
        options={options.sources}
      />
      <Select
        label="Closer"
        value={closer}
        onChange={(v) => apply({ closer: v })}
        options={options.closers}
        labelize={shortEmail}
      />
      <Select
        label="Setter"
        value={setter}
        onChange={(v) => apply({ setter: v })}
        options={options.setters}
        labelize={shortEmail}
      />
      <Select
        label="Triage"
        value={triage}
        onChange={(v) => apply({ triage: v })}
        options={options.triageCallers}
        labelize={shortEmail}
      />
      <Select
        label="Outcome"
        value={callOutcome}
        onChange={(v) => apply({ callOutcome: v })}
        options={options.callOutcomes}
      />
      <Select
        label="OCC / FUC"
        value={occFuc}
        onChange={(v) => apply({ occFuc: v })}
        options={options.occFucs}
      />

      <label className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Email
        </span>
        <input
          type="search"
          placeholder="substring…"
          defaultValue={emailLike}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              apply({ email: v || null });
            }
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== emailLike) apply({ email: v || null });
          }}
          className={cn(CTRL, "w-44 placeholder:text-muted-foreground/60")}
        />
      </label>

      {hasAny ? (
        <button
          type="button"
          onClick={reset}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <XIcon className="h-3 w-3" /> Reset all
        </button>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  labelize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelize?: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={CTRL}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labelize ? labelize(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
