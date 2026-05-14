"use client";

// Per-closer leaderboard for /dashboards/sales. URL-driven sort.
// Apple-feel hairline table; semantic alert-* coloring for ROAS-style
// signals (close rate ≥ 30 = green, < 15 = red).

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { fmt } from "@/components/webinar/format";
import type { CloserAggregate } from "@/lib/sales";

type Align = "left" | "right";

const COLUMNS: Array<{
  key: keyof CloserAggregate | "rank";
  label: string;
  align: Align;
}> = [
  { key: "rank", label: "#", align: "left" },
  { key: "closer_name", label: "Closer", align: "left" },
  { key: "prospects_on_the_calendar", label: "Prospects", align: "right" },
  { key: "unique_calls_held", label: "Held", align: "right" },
  { key: "show_rate", label: "Show %", align: "right" },
  { key: "deals_closed_won", label: "Deals", align: "right" },
  { key: "close_rate", label: "Close %", align: "right" },
  { key: "deposits_taken", label: "Deposits", align: "right" },
  { key: "cash_collected", label: "Cash", align: "right" },
  { key: "revenue_generated", label: "Revenue", align: "right" },
  { key: "aov", label: "AOV", align: "right" },
  { key: "acv", label: "ACV", align: "right" },
  { key: "collection_rate", label: "Collection %", align: "right" },
];

const CLOSE_RATE_HOT = 0.3;
const CLOSE_RATE_COLD = 0.15;

export function CloserLeaderboard({
  rows,
  sort,
  dir,
}: {
  rows: CloserAggregate[];
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setSort = (key: string) => {
    if (key === "rank") return; // rank isn't sortable
    const next = new URLSearchParams(params);
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    startTransition(() =>
      router.push(`/dashboards/sales?${next.toString()}`, { scroll: false }),
    );
  };

  const closeRateClass = (rate: number | null): string => {
    if (rate == null) return "";
    if (rate >= CLOSE_RATE_HOT) return "font-semibold text-alert-green";
    if (rate < CLOSE_RATE_COLD) return "text-alert-red";
    return "";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Closer leaderboard
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} closer{rows.length === 1 ? "" : "s"} · click header to sort
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((c) => (
                <th
                  key={c.key as string}
                  onClick={() => setSort(c.key as string)}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
                    c.align === "right" ? "text-right" : "text-left",
                    c.key === "rank"
                      ? ""
                      : "cursor-pointer select-none hover:text-foreground",
                  )}
                >
                  {c.label}
                  {sort === (c.key as string) ? (
                    <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            data-pending={pending ? "" : undefined}
            className="data-[pending]:opacity-60 data-[pending]:transition-opacity"
          >
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No closer activity in this period.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.closer_name}
                  className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {r.closer_name}
                    {r.has_legacy ? (
                      <span className="ml-2 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        legacy
                      </span>
                    ) : null}
                  </td>
                  <Num value={fmt.int(r.prospects_on_the_calendar)} />
                  <Num value={fmt.int(r.unique_calls_held)} />
                  <Num value={fmt.pct(r.show_rate)} />
                  <Num value={fmt.int(r.deals_closed_won)} />
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      closeRateClass(r.close_rate),
                    )}
                  >
                    {fmt.pct(r.close_rate)}
                  </td>
                  <Num value={fmt.int(r.deposits_taken)} />
                  <Num value={fmt.money(r.cash_collected)} />
                  <Num value={fmt.money(r.revenue_generated)} />
                  <Num value={fmt.money(r.aov)} />
                  <Num value={fmt.money(r.acv)} />
                  <Num value={fmt.pct(r.collection_rate)} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Num({ value }: { value: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      {value}
    </td>
  );
}
