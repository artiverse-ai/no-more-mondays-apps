// BigQuery data layer for the CEO / High-Level dashboard (/dashboards/high-level).
//
// Sources:
//   - mart_high_level_daily: zero-filled daily marketing + sales rollup
//     (all Meta campaigns, all Calendly strategy calls — NOT just webinar).
//   - int_calls_enriched: per-call rows used for the sales-cycle medians.
//
// Both live in `no-more-mondays-analytics.dbt_tuddin`. The Vercel service
// account needs `roles/bigquery.dataViewer` on that dataset (already granted
// for the webinar dashboard — see docs/DEPLOY.md).
//
// Aligned with analytics-repo PR #43; see
// docs/sales-ceo-dashboard-update-2026-05.md for the full mart spec + the
// exact KPI formulas this file implements.

import { bq } from "./bq";

const MART_HIGH_LEVEL_DAILY =
  "`no-more-mondays-analytics.dbt_tuddin.mart_high_level_daily`";
const INT_CALLS_ENRICHED =
  "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// =====================================================================
// Types
// =====================================================================

export type HighLevelDay = {
  metric_date: string; // YYYY-MM-DD

  // Marketing-side (keyed on date_closed for cash/revenue/deals/PIF)
  total_ad_spend: number | null; // ALL Meta campaigns that day
  total_calls_booked: number | null; // strategy-call Calendly only
  total_calls_booked_active: number | null;
  total_cash_collected: number | null;
  total_revenue_contracted: number | null; // TCV
  total_deals_closed: number | null;
  count_pif_deals: number | null;

  // Funnel-stage (keyed on appointment_date_time::date)
  count_prospects_dispositioned: number | null;
  count_show_rate_eligible: number | null;
  count_show_ups: number | null;
  count_close_rate_eligible: number | null; // closer-qualified shows (excludes Closer DQ)
  count_deals_attended: number | null;
  count_setter_dq: number | null;
  count_closer_dq: number | null;

  dbt_updated_at: string | null; // ISO
};

export type SalesCycleRow = {
  booking_to_close_days: number | null;
  first_call_to_close_days: number | null;
  close_type: "OCC" | "FUC" | null;
};

export type CeoKpis = {
  // Marketing tiles
  totalAdSpend: number;
  totalCallsBooked: number;
  totalCashCollected: number;
  totalRevenueContracted: number;
  costPerBookedCall: number | null;
  cashPerBookedCall: number | null;
  roasTcc: number | null;
  roasTcv: number | null;

  // Sales tiles
  showRate: number | null;
  closeRateOnShows: number | null;
  closeRateCloserQualified: number | null;
  setterDqRate: number | null;
  closerDqRate: number | null;
  aov: number | null;
  acv: number | null;
  pifRate: number | null;
};

export type ResolvedPeriod = {
  /** URL period key. */
  period: PeriodKey;
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  /** Human-readable: "Last 30 days", "Month to date", etc. */
  label: string;
};

export type PeriodKey =
  | "7d"
  | "30d"
  | "90d"
  | "mtd"
  | "qtd"
  | "ytd"
  | "custom";

// =====================================================================
// BigQuery value normalization (mirror of lib/webinar.ts; deliberately
// duplicated to keep the two data layers independent — small, parallel
// modules. Refactor into lib/bq.ts if a third consumer appears.)
// =====================================================================

function unwrap(v: unknown): unknown {
  if (
    v != null &&
    typeof v === "object" &&
    "value" in (v as Record<string, unknown>)
  ) {
    return (v as { value: unknown }).value;
  }
  return v;
}

function asStr(v: unknown): string | null {
  const u = unwrap(v);
  return u == null ? null : String(u);
}

function asDate(v: unknown): string {
  return (asStr(v) ?? "").slice(0, 10);
}

function asNum(v: unknown): number | null {
  const u = unwrap(v);
  if (u == null || u === "") return null;
  const n = Number(u);
  return Number.isFinite(n) ? n : null;
}

function toHighLevelDay(row: Record<string, unknown>): HighLevelDay {
  return {
    metric_date: asDate(row.metric_date),
    total_ad_spend: asNum(row.total_ad_spend),
    total_calls_booked: asNum(row.total_calls_booked),
    total_calls_booked_active: asNum(row.total_calls_booked_active),
    total_cash_collected: asNum(row.total_cash_collected),
    total_revenue_contracted: asNum(row.total_revenue_contracted),
    total_deals_closed: asNum(row.total_deals_closed),
    count_pif_deals: asNum(row.count_pif_deals),
    count_prospects_dispositioned: asNum(row.count_prospects_dispositioned),
    count_show_rate_eligible: asNum(row.count_show_rate_eligible),
    count_show_ups: asNum(row.count_show_ups),
    count_close_rate_eligible: asNum(row.count_close_rate_eligible),
    count_deals_attended: asNum(row.count_deals_attended),
    count_setter_dq: asNum(row.count_setter_dq),
    count_closer_dq: asNum(row.count_closer_dq),
    dbt_updated_at: asStr(row.dbt_updated_at),
  };
}

function toSalesCycleRow(row: Record<string, unknown>): SalesCycleRow {
  const ct = asStr(row.close_type);
  return {
    booking_to_close_days: asNum(row.booking_to_close_days),
    first_call_to_close_days: asNum(row.first_call_to_close_days),
    close_type: ct === "OCC" || ct === "FUC" ? ct : null,
  };
}

// =====================================================================
// Queries
// =====================================================================

export async function getHighLevelRange(args: {
  from: string;
  to: string;
}): Promise<HighLevelDay[]> {
  const [rows] = await bq().query({
    query: `
      SELECT *
      FROM ${MART_HIGH_LEVEL_DAILY}
      WHERE metric_date BETWEEN DATE(@from) AND DATE(@to)
      ORDER BY metric_date`,
    params: { from: args.from, to: args.to },
    types: { from: "STRING", to: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toHighLevelDay);
}

export async function getSalesCyclesRange(args: {
  from: string;
  to: string;
}): Promise<SalesCycleRow[]> {
  const [rows] = await bq().query({
    query: `
      SELECT booking_to_close_days, first_call_to_close_days, close_type
      FROM ${INT_CALLS_ENRICHED}
      WHERE is_deal AND date_closed BETWEEN DATE(@from) AND DATE(@to)`,
    params: { from: args.from, to: args.to },
    types: { from: "STRING", to: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toSalesCycleRow);
}

// =====================================================================
// KPI computations
//
// Rates are SUM(numerator) / SUM(denominator) across the period — NOT
// the average of daily rates. Yields the same answer as if you ran a
// single SQL query over the period, and avoids the "average of averages"
// trap on zero-denominator days.
// =====================================================================

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export function computeCeoKpis(rows: HighLevelDay[]): CeoKpis {
  let totalAdSpend = 0,
    totalCallsBooked = 0,
    totalCashCollected = 0,
    totalRevenueContracted = 0,
    totalDealsClosed = 0,
    countPifDeals = 0,
    countProspectsDispositioned = 0,
    countShowRateEligible = 0,
    countShowUps = 0,
    countCloseRateEligible = 0,
    countDealsAttended = 0,
    countSetterDq = 0,
    countCloserDq = 0;

  for (const r of rows) {
    totalAdSpend += r.total_ad_spend ?? 0;
    totalCallsBooked += r.total_calls_booked ?? 0;
    totalCashCollected += r.total_cash_collected ?? 0;
    totalRevenueContracted += r.total_revenue_contracted ?? 0;
    totalDealsClosed += r.total_deals_closed ?? 0;
    countPifDeals += r.count_pif_deals ?? 0;
    countProspectsDispositioned += r.count_prospects_dispositioned ?? 0;
    countShowRateEligible += r.count_show_rate_eligible ?? 0;
    countShowUps += r.count_show_ups ?? 0;
    countCloseRateEligible += r.count_close_rate_eligible ?? 0;
    countDealsAttended += r.count_deals_attended ?? 0;
    countSetterDq += r.count_setter_dq ?? 0;
    countCloserDq += r.count_closer_dq ?? 0;
  }

  return {
    totalAdSpend,
    totalCallsBooked,
    totalCashCollected,
    totalRevenueContracted,
    costPerBookedCall: div(totalAdSpend, totalCallsBooked),
    cashPerBookedCall: div(totalCashCollected, totalCallsBooked),
    roasTcc: div(totalCashCollected, totalAdSpend),
    roasTcv: div(totalRevenueContracted, totalAdSpend),

    showRate: div(countShowUps, countShowRateEligible),
    closeRateOnShows: div(countDealsAttended, countShowUps),
    closeRateCloserQualified: div(countDealsAttended, countCloseRateEligible),
    setterDqRate: div(countSetterDq, countProspectsDispositioned),
    closerDqRate: div(countCloserDq, countShowUps),
    aov: div(totalCashCollected, totalDealsClosed),
    acv: div(totalRevenueContracted, totalDealsClosed),
    pifRate: div(countPifDeals, totalDealsClosed),
  };
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// =====================================================================
// Granularity rollup for the daily mart (CEO trend chart)
// =====================================================================

export type TrendGranularity = "day" | "week" | "month" | "year";

function toSundayStart(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

function bucketKey(date: string, gran: TrendGranularity): string {
  if (gran === "week") return toSundayStart(date);
  if (gran === "month") return date.slice(0, 7) + "-01";
  if (gran === "year") return date.slice(0, 4) + "-01-01";
  return date;
}

/** Auto-suggest granularity from the resolved period span. */
export function suggestGranularity(args: {
  from: string;
  to: string;
}): TrendGranularity {
  const ms =
    new Date(args.to + "T00:00:00Z").getTime() -
    new Date(args.from + "T00:00:00Z").getTime();
  const days = Math.max(1, Math.round(ms / 86_400_000) + 1);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 730) return "month";
  return "year";
}

/** Roll mart_high_level_daily rows up to the chosen granularity. Sums every
 *  additive counter; metric_date is the bucket start (Sunday for week,
 *  1st-of-month for month, Jan-1 for year). dbt_updated_at gets the bucket's
 *  latest timestamp so the page header still shows a meaningful refresh time. */
export function aggregateHighLevelByGran(
  rows: HighLevelDay[],
  gran: TrendGranularity,
): HighLevelDay[] {
  if (gran === "day") return rows;
  const map = new Map<string, HighLevelDay>();
  for (const r of rows) {
    const key = bucketKey(r.metric_date, gran);
    let pt = map.get(key);
    if (!pt) {
      pt = {
        metric_date: key,
        total_ad_spend: 0,
        total_calls_booked: 0,
        total_calls_booked_active: 0,
        total_cash_collected: 0,
        total_revenue_contracted: 0,
        total_deals_closed: 0,
        count_pif_deals: 0,
        count_prospects_dispositioned: 0,
        count_show_rate_eligible: 0,
        count_show_ups: 0,
        count_close_rate_eligible: 0,
        count_deals_attended: 0,
        count_setter_dq: 0,
        count_closer_dq: 0,
        dbt_updated_at: r.dbt_updated_at,
      };
      map.set(key, pt);
    }
    pt.total_ad_spend = (pt.total_ad_spend ?? 0) + (r.total_ad_spend ?? 0);
    pt.total_calls_booked =
      (pt.total_calls_booked ?? 0) + (r.total_calls_booked ?? 0);
    pt.total_calls_booked_active =
      (pt.total_calls_booked_active ?? 0) + (r.total_calls_booked_active ?? 0);
    pt.total_cash_collected =
      (pt.total_cash_collected ?? 0) + (r.total_cash_collected ?? 0);
    pt.total_revenue_contracted =
      (pt.total_revenue_contracted ?? 0) + (r.total_revenue_contracted ?? 0);
    pt.total_deals_closed =
      (pt.total_deals_closed ?? 0) + (r.total_deals_closed ?? 0);
    pt.count_pif_deals = (pt.count_pif_deals ?? 0) + (r.count_pif_deals ?? 0);
    pt.count_prospects_dispositioned =
      (pt.count_prospects_dispositioned ?? 0) +
      (r.count_prospects_dispositioned ?? 0);
    pt.count_show_rate_eligible =
      (pt.count_show_rate_eligible ?? 0) + (r.count_show_rate_eligible ?? 0);
    pt.count_show_ups = (pt.count_show_ups ?? 0) + (r.count_show_ups ?? 0);
    pt.count_close_rate_eligible =
      (pt.count_close_rate_eligible ?? 0) + (r.count_close_rate_eligible ?? 0);
    pt.count_deals_attended =
      (pt.count_deals_attended ?? 0) + (r.count_deals_attended ?? 0);
    pt.count_setter_dq = (pt.count_setter_dq ?? 0) + (r.count_setter_dq ?? 0);
    pt.count_closer_dq = (pt.count_closer_dq ?? 0) + (r.count_closer_dq ?? 0);
    if (
      r.dbt_updated_at &&
      (!pt.dbt_updated_at || r.dbt_updated_at > pt.dbt_updated_at)
    ) {
      pt.dbt_updated_at = r.dbt_updated_at;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.metric_date.localeCompare(b.metric_date),
  );
}

export function medianBookingToClose(
  rows: SalesCycleRow[],
): { value: number | null; n: number } {
  const vals: number[] = [];
  for (const r of rows) {
    if (r.close_type === "OCC" && r.booking_to_close_days != null) {
      vals.push(r.booking_to_close_days);
    }
  }
  return { value: median(vals), n: vals.length };
}

export function medianFirstCallToClose(
  rows: SalesCycleRow[],
): { value: number | null; n: number } {
  const vals: number[] = [];
  for (const r of rows) {
    if (r.close_type === "FUC" && r.first_call_to_close_days != null) {
      vals.push(r.first_call_to_close_days);
    }
  }
  return { value: median(vals), n: vals.length };
}

// =====================================================================
// Period resolution (URL ?period= … → {from, to})
// =====================================================================

const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  mtd: "Month to date",
  qtd: "Quarter to date",
  ytd: "Year to date",
  custom: "Custom",
};

export function isPeriodKey(v: string): v is PeriodKey {
  return v in PERIOD_LABELS;
}

function todayInNY(): string {
  // en-CA gives YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function resolvePeriod(args: {
  period: PeriodKey;
  from?: string;
  to?: string;
}): ResolvedPeriod {
  const today = todayInNY();
  const [y, m] = today.split("-").map((n) => parseInt(n, 10));

  switch (args.period) {
    case "7d":
      return {
        period: "7d",
        from: shiftDay(today, -6),
        to: today,
        label: PERIOD_LABELS["7d"],
      };
    case "30d":
      return {
        period: "30d",
        from: shiftDay(today, -29),
        to: today,
        label: PERIOD_LABELS["30d"],
      };
    case "90d":
      return {
        period: "90d",
        from: shiftDay(today, -89),
        to: today,
        label: PERIOD_LABELS["90d"],
      };
    case "mtd":
      return {
        period: "mtd",
        from: `${y}-${pad(m)}-01`,
        to: today,
        label: PERIOD_LABELS.mtd,
      };
    case "qtd": {
      const qStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
      return {
        period: "qtd",
        from: `${y}-${pad(qStartMonth)}-01`,
        to: today,
        label: PERIOD_LABELS.qtd,
      };
    }
    case "ytd":
      return {
        period: "ytd",
        from: `${y}-01-01`,
        to: today,
        label: PERIOD_LABELS.ytd,
      };
    case "custom": {
      const from = args.from && /^\d{4}-\d{2}-\d{2}$/.test(args.from)
        ? args.from
        : shiftDay(today, -29);
      const to = args.to && /^\d{4}-\d{2}-\d{2}$/.test(args.to) ? args.to : today;
      return { period: "custom", from, to, label: PERIOD_LABELS.custom };
    }
  }
}
