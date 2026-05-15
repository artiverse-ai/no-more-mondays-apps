"use client";

// Per-webinar leaderboard — the "pre-webinar breakdown" the team reads
// most often. D4 expansion: every PR-#42/#43 column with latest naming,
// sticky first three columns (Date / Day / Era) for orientation while
// horizontally scrolling, header InfoTips on every metric column, and
// click-row-to-drill-in.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { useReportTransition } from "@/lib/nav-progress-context";
import { cn } from "@/lib/utils";
import type { WebinarEvent } from "@/lib/webinar";
import { dayBadgeClass, eraBadgeClass, eraLabel, fmt } from "./format";

type Align = "left" | "right";
type Format = "money" | "money2" | "int" | "number" | "pct" | "ratio" | "text";

type Column = {
  key: keyof WebinarEvent | "rank";
  label: string;
  align: Align;
  metric?: string; // key into lib/metricDefs.ts for the InfoTip
  format?: Format;
  /** Pixel offset when the column is sticky. Only set on the first 3. */
  sticky?: number;
  width?: string; // tailwind class
};

const COLUMNS: Column[] = [
  // Sticky orientation columns
  { key: "webinar_date", label: "Date", align: "left", sticky: 0, width: "min-w-[120px]" },
  { key: "webinar_day", label: "Day", align: "left", sticky: 120, width: "min-w-[112px]" },
  { key: "data_era", label: "Era", align: "left", sticky: 232, width: "min-w-[112px]" },

  // Marketing
  { key: "total_webinar_ad_spend", label: "Ad Spend", align: "right", metric: "total_webinar_ad_spend", format: "money2" },
  { key: "webinar_reg_ad_spend", label: "Reg Spend", align: "right", metric: "webinar_reg_ad_spend", format: "money2" },
  { key: "webinar_hammer_them_ad_spend", label: "HT Spend", align: "right", metric: "webinar_hammer_them_ad_spend", format: "money2" },
  { key: "meta_link_clicks", label: "Link Clicks", align: "right", metric: "meta_link_clicks", format: "number" },

  // Funnel
  { key: "lp_page_views", label: "Page Views", align: "right", metric: "lp_page_views", format: "number" },
  { key: "lp_opt_ins", label: "Opt-ins", align: "right", metric: "lp_opt_ins", format: "number" },
  { key: "total_registrants", label: "Regs", align: "right", metric: "total_registrants", format: "int" },
  { key: "unique_attendees", label: "Attendees", align: "right", metric: "unique_attendees", format: "int" },
  { key: "pitched_attendees", label: "Pitched", align: "right", metric: "pitched_attendees", format: "int" },
  { key: "calls_booked", label: "Booked", align: "right", metric: "calls_booked", format: "int" },
  { key: "shows", label: "Shows", align: "right", metric: "shows", format: "int" },
  { key: "qualified_shows", label: "Qualified Shows", align: "right", metric: "qualified_shows", format: "int" },
  { key: "deals_closed", label: "Deals", align: "right", metric: "deals_closed", format: "int" },
  { key: "webinar_deposits", label: "Deposits", align: "right", metric: "webinar_deposits", format: "int" },

  // Money
  { key: "cash_collected", label: "Cash", align: "right", metric: "total_cash_collected", format: "money" },
  { key: "revenue_generated", label: "Revenue", align: "right", metric: "total_revenue_contracted", format: "money" },
  { key: "cash_collected_per_attendee", label: "Cash/Att", align: "right", metric: "cash_collected_per_attendee", format: "money" },
  { key: "contract_value_per_attendee", label: "TCV/Att", align: "right", metric: "contract_value_per_attendee", format: "money" },

  // Efficiency (cost-per-stage; runs reg → booked → show → qual-show → deal)
  { key: "paid_cpr", label: "$/Reg", align: "right", metric: "paid_cpr", format: "money2" },
  { key: "blended_cpbc", label: "$/Booked", align: "right", metric: "blended_cpbc", format: "money2" },
  { key: "blended_cpbc_active", label: "$/Active Bk", align: "right", metric: "blended_cpbc_active", format: "money2" },
  { key: "blended_cost_per_show", label: "$/Show", align: "right", metric: "blended_cost_per_show", format: "money2" },
  { key: "blended_cost_per_qualified_show", label: "$/Q.Show", align: "right", metric: "blended_cost_per_qualified_show", format: "money2" },
  { key: "cac", label: "CAC", align: "right", metric: "cac", format: "money" },

  // ROAS
  { key: "roas_cash", label: "ROAS$", align: "right", metric: "roas_cash", format: "ratio" },
  { key: "roas_revenue", label: "ROAS-Rev", align: "right", metric: "roas_revenue", format: "ratio" },
  { key: "roas_cash_running", label: "Live ROAS", align: "right", metric: "roas_cash_running", format: "ratio" },
];

const SORT_DEFAULT = "webinar_date";

export function WebinarTable({
  rows,
  sort,
  dir,
  total,
  devMode = false,
}: {
  rows: WebinarEvent[];
  sort: string;
  dir: "asc" | "desc";
  total: number;
  devMode?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);

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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Per-webinar leaderboard
        </span>
        <span className="text-[11px] text-muted-foreground">
          {rows.length} of {total} · first 3 columns stick · hover{" "}
          <code className="rounded bg-muted/60 px-1 py-0.5 text-[10px] font-mono">
            i
          </code>{" "}
          on a header for the formula
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const isSticky = c.sticky != null;
                return (
                  <th
                    key={c.key as string}
                    onClick={() => setSort(c.key === "rank" ? SORT_DEFAULT : (c.key as string))}
                    style={
                      isSticky
                        ? { left: c.sticky, position: "sticky", zIndex: 2 }
                        : undefined
                    }
                    className={cn(
                      "cursor-pointer select-none whitespace-nowrap border-b border-border bg-muted/60 px-3 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground",
                      c.align === "right" ? "text-right" : "text-left",
                      c.width,
                      isSticky ? "shadow-[1px_0_0_var(--border)]" : "",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {sort === c.key ? (
                        <span>{dir === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                      {c.metric ? (
                        <span onClick={(e) => e.stopPropagation()}>
                          <InfoTip metric={c.metric} devMode={devMode} size={11} />
                        </span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
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
              rows.map((r, rowIdx) => (
                <tr
                  key={r.webinar_date}
                  onClick={() => go(r.webinar_date)}
                  className="cursor-pointer hover:bg-muted/30"
                >
                  {COLUMNS.map((c) => {
                    const v = r[c.key as keyof WebinarEvent];
                    const isSticky = c.sticky != null;
                    const isLastRow = rowIdx === rows.length - 1;
                    return (
                      <td
                        key={c.key as string}
                        style={
                          isSticky
                            ? { left: c.sticky, position: "sticky", zIndex: 1 }
                            : undefined
                        }
                        className={cn(
                          "whitespace-nowrap px-3 py-2 tabular-nums",
                          isLastRow ? "" : "border-b border-border/60",
                          c.align === "right" ? "text-right" : "text-left",
                          isSticky
                            ? "bg-card shadow-[1px_0_0_var(--border)]"
                            : "",
                        )}
                      >
                        {renderCell(c, v, r)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(c: Column, v: unknown, row: WebinarEvent): React.ReactNode {
  // Special-cased sticky orientation columns.
  if (c.key === "webinar_date") {
    return <span className="font-medium">{fmt.date(row.webinar_date)}</span>;
  }
  if (c.key === "webinar_day") {
    return (
      <Badge variant="outline" className={dayBadgeClass(row.webinar_day)}>
        {row.webinar_day || "—"}
      </Badge>
    );
  }
  if (c.key === "data_era") {
    return (
      <Badge variant="outline" className={eraBadgeClass(row.data_era)}>
        {eraLabel(row.data_era)}
      </Badge>
    );
  }

  if (v == null) {
    // Explain WHY this cell is empty instead of leaving a mute dash.
    const reason = nullReason(c.key as string, row);
    return (
      <span
        className="text-muted-foreground/60"
        title={reason}
      >
        —
      </span>
    );
  }

  switch (c.format) {
    case "money":
      return fmt.money(v as number);
    case "money2":
      return fmt.money2(v as number);
    case "int":
      return fmt.int(v as number);
    case "number":
      return fmt.number(v as number);
    case "pct":
      return fmt.pct(v as number);
    case "ratio": {
      const n = v as number;
      const cls =
        n >= 1
          ? "font-semibold text-accent"
          : "font-medium text-alert-orange"; // <1× is underperforming, not "grayed" — call it out.
      return <span className={cls}>{fmt.ratio(n)}</span>;
    }
    default:
      return String(v);
  }
}

// Human-readable explanation of why a cell is empty. The big offenders
// are ROAS / CAC / cost-per-* on legacy webinars (Fanbasis didn't exist)
// and the in-progress latest Sunday (booking window still open).
function nullReason(columnKey: string, row: WebinarEvent): string {
  const roasLike =
    columnKey === "roas_cash" ||
    columnKey === "roas_revenue" ||
    columnKey === "roas_cash_running" ||
    columnKey === "cac" ||
    columnKey === "blended_cost_per_qualified_show" ||
    columnKey === "blended_cost_per_show" ||
    columnKey === "blended_cpbc_active";

  if (row.is_legacy && roasLike) {
    return "Not available — legacy webinar (Fanbasis coverage starts mid-2025, so Live ROAS / CAC can't be computed for pre-2025 events).";
  }
  if (roasLike) {
    return "Not yet available — webinar is in progress (booking window still open) or upstream mart hasn't computed this column yet.";
  }
  return "No value available for this webinar.";
}
