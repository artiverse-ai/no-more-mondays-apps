"use client";

// Per-setter leaderboard for /dashboards/setter.
// Aligns with the same Apple-feel hairline table as the closer one.

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { fmt } from "@/components/webinar/format";
import type { SetterRow } from "@/lib/setter";

type Align = "left" | "right";

const COLUMNS: Array<{
  key: keyof SetterRow | "rank";
  label: string;
  align: Align;
}> = [
  { key: "rank", label: "#", align: "left" },
  { key: "setter", label: "Setter", align: "left" },
  { key: "bookings", label: "Bookings", align: "right" },
  { key: "active_bookings", label: "Active", align: "right" },
  { key: "show_ups", label: "Shows", align: "right" },
  { key: "show_rate", label: "Show %", align: "right" },
  { key: "setter_dq_rate", label: "Setter DQ %", align: "right" },
  { key: "qualified_shows", label: "Qual. Shows", align: "right" },
  { key: "qualified_rate", label: "Qual. %", align: "right" },
  { key: "closer_dq_rate", label: "Closer DQ %", align: "right" },
  { key: "deals", label: "Deals", align: "right" },
  { key: "cash_attributed", label: "Cash", align: "right" },
  { key: "cash_per_booking", label: "Cash/Bk", align: "right" },
];

const SETTER_DQ_HOT = 0.4; // > 40% Setter DQ is a red flag
const QUALIFIED_HOT = 0.7;
const QUALIFIED_COLD = 0.5;

export function SetterLeaderboard({
  rows,
  sort,
  dir,
}: {
  rows: SetterRow[];
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setSort = (key: string) => {
    if (key === "rank") return;
    const next = new URLSearchParams(params);
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    startTransition(() =>
      router.push(`/dashboards/setter?${next.toString()}`, { scroll: false }),
    );
  };

  const dqClass = (rate: number | null): string => {
    if (rate == null) return "";
    if (rate >= SETTER_DQ_HOT) return "text-alert-red";
    return "";
  };
  const qualClass = (rate: number | null): string => {
    if (rate == null) return "";
    if (rate >= QUALIFIED_HOT) return "font-semibold text-alert-green";
    if (rate < QUALIFIED_COLD) return "text-alert-red";
    return "";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Setter leaderboard
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} setter{rows.length === 1 ? "" : "s"} · click header to sort
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
                  No setter activity in this period.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.setter}
                  className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {r.setter}
                  </td>
                  <Num value={fmt.int(r.bookings)} />
                  <Num value={fmt.int(r.active_bookings)} />
                  <Num value={fmt.int(r.show_ups)} />
                  <Num value={fmt.pct(r.show_rate)} />
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      dqClass(r.setter_dq_rate),
                    )}
                  >
                    {fmt.pct(r.setter_dq_rate)}
                  </td>
                  <Num value={fmt.int(r.qualified_shows)} />
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      qualClass(r.qualified_rate),
                    )}
                  >
                    {fmt.pct(r.qualified_rate)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      dqClass(r.closer_dq_rate),
                    )}
                  >
                    {fmt.pct(r.closer_dq_rate)}
                  </td>
                  <Num value={fmt.int(r.deals)} />
                  <Num value={fmt.money(r.cash_attributed)} />
                  <Num value={fmt.money2(r.cash_per_booking)} />
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
