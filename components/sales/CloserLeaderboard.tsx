"use client";

// Per-closer leaderboard for /dashboards/sales (D2 rebuild). Sortable
// URL-driven columns; click a closer's name to set the closer cross-filter.
// Columns reflect the canonical lib/calls.ts CloserRollup shape — no more
// is_call_held derivations.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useReportTransition } from "@/lib/nav-progress-context";
import { cn } from "@/lib/utils";
import { fmt } from "@/components/webinar/format";
import type { CloserRollup } from "@/lib/calls";

type Align = "left" | "right";

// Column order mirrors Monday Report §9.5 Closer Performance Overall:
// Closer · Prospects · D'd · S.DQ · S.DQ% · C.DQ · C.DQ% · SQ · Shows ·
// Show% · Q.Shows · Close% (Shows) · Close% (CQ) · Deals · Cash · TCV ·
// AOV · ACV.
const COLUMNS: Array<{
  key: keyof CloserRollup | "rank";
  label: string;
  align: Align;
}> = [
  { key: "rank", label: "#", align: "left" },
  { key: "closer", label: "Closer", align: "left" },
  { key: "prospects", label: "Prospects", align: "right" },
  { key: "dispositioned", label: "Disposed", align: "right" },
  { key: "setter_dq", label: "S.DQ", align: "right" },
  { key: "setter_dq_rate", label: "S.DQ %", align: "right" },
  { key: "closer_dq", label: "C.DQ", align: "right" },
  { key: "closer_dq_rate", label: "C.DQ %", align: "right" },
  { key: "prospects_sq", label: "SQ", align: "right" },
  { key: "shows_sq", label: "Shows", align: "right" },
  { key: "show_rate", label: "Show %", align: "right" },
  { key: "shows_cq", label: "Qualified Shows", align: "right" },
  { key: "close_rate_shows", label: "Close % (Shows)", align: "right" },
  { key: "close_rate_cq", label: "Close % (CQ)", align: "right" },
  { key: "deposits", label: "Deposits", align: "right" },
  { key: "deals", label: "Deals", align: "right" },
  { key: "cash", label: "Cash", align: "right" },
  { key: "tcv", label: "TCV", align: "right" },
  { key: "aov", label: "AOV", align: "right" },
  { key: "acv", label: "ACV", align: "right" },
];

const CLOSE_RATE_HOT = 0.3;
const CLOSE_RATE_COLD = 0.15;

const shortName = (email: string) => (email.includes("@") ? email.split("@")[0] : email);

export function CloserLeaderboard({
  rows,
  sort,
  dir,
  pathname,
}: {
  rows: CloserRollup[];
  sort: string;
  dir: "asc" | "desc";
  pathname: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);

  const sorted = sortRows(rows, sort, dir);

  const navigate = (next: URLSearchParams) =>
    startTransition(() =>
      router.push(`${pathname}?${next.toString()}`, { scroll: false }),
    );

  const setSort = (key: string) => {
    if (key === "rank") return;
    const next = new URLSearchParams(params);
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    navigate(next);
  };

  const setCloserFilter = (closer: string) => {
    const next = new URLSearchParams(params);
    next.set("closer", closer);
    navigate(next);
  };

  const closeRateClass = (rate: number | null): string => {
    if (rate == null) return "";
    if (rate >= CLOSE_RATE_HOT) return "font-semibold text-alert-green";
    if (rate < CLOSE_RATE_COLD) return "text-alert-red";
    return "";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Closer leaderboard
        </span>
        <span className="text-[11px] text-muted-foreground">
          {sorted.length} closer{sorted.length === 1 ? "" : "s"} · click header to sort, name to filter
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
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No closer activity in this period.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr
                  key={r.closer}
                  className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">
                    {i + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setCloserFilter(r.closer)}
                      className="rounded-md px-1.5 py-0.5 hover:bg-secondary"
                      title={`Filter to ${r.closer}`}
                    >
                      {shortName(r.closer)}
                    </button>
                  </td>
                  <Num value={fmt.int(r.prospects)} />
                  <Num value={fmt.int(r.dispositioned)} />
                  <Num value={fmt.int(r.setter_dq)} />
                  <Num value={fmt.pct(r.setter_dq_rate)} />
                  <Num value={fmt.int(r.closer_dq)} />
                  <Num value={fmt.pct(r.closer_dq_rate)} />
                  <Num value={fmt.int(r.prospects_sq)} />
                  <Num value={fmt.int(r.shows_sq)} />
                  <Num value={fmt.pct(r.show_rate)} />
                  <Num value={fmt.int(r.shows_cq)} />
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      closeRateClass(r.close_rate_shows),
                    )}
                  >
                    {fmt.pct(r.close_rate_shows)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      closeRateClass(r.close_rate_cq),
                    )}
                  >
                    {fmt.pct(r.close_rate_cq)}
                  </td>
                  <Num value={fmt.int(r.deposits)} />
                  <Num value={fmt.int(r.deals)} />
                  <Num value={fmt.money(r.cash)} />
                  <Num value={fmt.money(r.tcv)} />
                  <Num value={fmt.money(r.aov)} />
                  <Num value={fmt.money(r.acv)} />
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

function sortRows(rows: CloserRollup[], key: string, dir: "asc" | "desc"): CloserRollup[] {
  if (key === "rank" || !rows.length) return rows;
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key];
    const bv = (b as unknown as Record<string, unknown>)[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * m;
    return String(av).localeCompare(String(bv)) * m;
  });
}
