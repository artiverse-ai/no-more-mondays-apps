"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WebinarEvent } from "@/lib/webinar";
import { dayBadgeClass, eraBadgeClass, eraLabel, fmt } from "./format";

type Align = "left" | "right";

const COLUMNS: Array<{ key: string; label: string; align: Align }> = [
  { key: "webinar_date", label: "Date", align: "left" },
  { key: "webinar_day", label: "Day", align: "left" },
  { key: "data_era", label: "Era", align: "left" },
  { key: "ad_spend", label: "Spend", align: "right" },
  { key: "total_registrants", label: "Regs", align: "right" },
  { key: "unique_attendees", label: "Attendees", align: "right" },
  { key: "pitched_attendees", label: "Pitched", align: "right" },
  { key: "calls_booked", label: "Booked", align: "right" },
  { key: "calls_held", label: "Held", align: "right" },
  { key: "deals_closed", label: "Deals", align: "right" },
  { key: "cash_collected", label: "Cash", align: "right" },
  { key: "revenue_generated", label: "Revenue", align: "right" },
  { key: "roas_cash", label: "ROAS", align: "right" },
  { key: "cac", label: "CAC", align: "right" },
];

export function WebinarTable({
  rows,
  sort,
  dir,
  total,
}: {
  rows: WebinarEvent[];
  sort: string;
  dir: "asc" | "desc";
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setSort = (key: string) => {
    const next = new URLSearchParams(params);
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    next.set("sort", key);
    next.set("dir", nextDir);
    startTransition(() =>
      router.push(`/dashboards/webinar?${next.toString()}`, { scroll: false }),
    );
  };

  const go = (date: string) =>
    router.push(`/dashboards/webinar/${encodeURIComponent(date)}`);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          All webinars
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} of {total} &middot; click a row to drill in
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => setSort(c.key)}
                  className={cn(
                    "cursor-pointer select-none whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.label}
                  {sort === c.key ? (
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
                  No webinars match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.webinar_date}
                  onClick={() => go(r.webinar_date)}
                  className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {fmt.date(r.webinar_date)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={dayBadgeClass(r.webinar_day)}>
                      {r.webinar_day || "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={eraBadgeClass(r.data_era)}>
                      {eraLabel(r.data_era)}
                    </Badge>
                  </td>
                  <Num value={fmt.money(r.ad_spend)} />
                  <Num value={fmt.int(r.total_registrants)} />
                  <Num value={fmt.int(r.unique_attendees)} />
                  <Num value={fmt.int(r.pitched_attendees)} />
                  <Num value={fmt.int(r.calls_booked)} />
                  <Num value={fmt.int(r.calls_held)} />
                  <Num value={fmt.int(r.deals_closed)} />
                  <Num value={fmt.money(r.cash_collected)} />
                  <Num value={fmt.money(r.revenue_generated)} />
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      r.roas_cash != null && r.roas_cash >= 1
                        ? "font-semibold text-accent"
                        : "",
                    )}
                  >
                    {r.roas_cash == null ? "—" : fmt.ratio(r.roas_cash)}
                  </td>
                  <Num value={fmt.money(r.cac)} />
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
