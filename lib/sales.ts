// BigQuery data layer for the Sales Performance (closer) dashboard
// (/dashboards/sales).
//
// Source: `mart_closer_weekly_performance` — actually daily-grain despite
// the name; UNIONs core + legacy intermediate tables. The mart's volume
// columns (`calls_held`, `unique_calls_held`, `show_rate`, `close_rate`,
// `prospect_to_close_rate`) are derived from the deprecated `is_call_held`
// flag (PR #43) and therefore over-count Setter DQs. We surface that
// caveat in the dashboard UI; an upstream PR will rebuild the mart on
// `is_show_up` later.

import { bq } from "./bq";

const MART_CLOSER_WEEKLY_PERFORMANCE =
  "`no-more-mondays-analytics.dbt_tuddin.mart_closer_weekly_performance`";
const INT_CALLS_ENRICHED =
  "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// =====================================================================
// Types
// =====================================================================

/** One row from mart_closer_weekly_performance — closer × appt_date. */
export type CloserRow = {
  appt_date: string; // YYYY-MM-DD
  closer_name: string;
  calls_on_the_calendar: number | null;
  prospects_on_the_calendar: number | null;
  dispositioned_prospects: number | null;
  calls_held: number | null;
  unique_calls_held: number | null;
  deals_closed_won: number | null;
  deposits_taken: number | null;
  cash_collected: number | null;
  revenue_generated: number | null;
  deposit_collected: number | null;
  revenue_predicted: number | null;
  avg_revenue_per_deal_acv: number | null;
  avg_cash_per_deal_aov: number | null;
  avg_days_to_close: number | null;
  show_rate: number | null;
  close_rate: number | null;
  prospect_to_close_rate: number | null;
  occ_rate: number | null;
  collection_rate: number | null;
  forecast_90d_remaining: number | null;
  is_legacy_data: boolean;
};

/** Per-closer rollup across a date range. Rates are SUM(num)/SUM(denom). */
export type CloserAggregate = {
  closer_name: string;
  days_active: number;
  // Volume
  calls_on_the_calendar: number;
  prospects_on_the_calendar: number;
  dispositioned_prospects: number;
  calls_held: number;
  unique_calls_held: number;
  deals_closed_won: number;
  deposits_taken: number;
  // Money
  cash_collected: number;
  revenue_generated: number;
  deposit_collected: number;
  revenue_predicted: number;
  forecast_90d_remaining: number;
  // Derived
  acv: number | null;          // revenue / deals
  aov: number | null;          // cash / deals
  show_rate: number | null;    // unique_calls_held / dispositioned_prospects
  close_rate: number | null;   // deals / unique_calls_held
  prospect_to_close_rate: number | null; // deals / prospects_on_the_calendar
  collection_rate: number | null;        // cash / revenue
  has_legacy: boolean;
};

/** Per-closer call drill row — used by the per-closer detail page. */
export type CloserCallRow = {
  prospect_email_lc: string | null;
  prospect_name: string | null;
  setter_owner: string | null;
  calendly_setter_name: string | null;
  call_outcome: string | null;
  call_date_time: string | null;
  appointment_date: string;
  final_marketing_flow: string | null;
  is_show_up: boolean;
  is_deal: boolean;
  is_deposit: boolean;
  is_canceled: boolean;
  is_rescheduled: boolean;
  is_ghosted: boolean;
  not_taken_category: string | null;
  cash_collected: number | null;
  revenue_generated: number | null;
};

// =====================================================================
// BigQuery value normalization (mirrors lib/webinar.ts conventions).
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
function asBool(v: unknown): boolean {
  const u = unwrap(v);
  return u === true || u === "true";
}

function toCloserRow(row: Record<string, unknown>): CloserRow {
  return {
    appt_date: asDate(row.appt_date),
    closer_name: asStr(row.closer_name) ?? "",
    calls_on_the_calendar: asNum(row.calls_on_the_calendar),
    prospects_on_the_calendar: asNum(row.prospects_on_the_calendar),
    dispositioned_prospects: asNum(row.dispositioned_prospects),
    calls_held: asNum(row.calls_held),
    unique_calls_held: asNum(row.unique_calls_held),
    deals_closed_won: asNum(row.deals_closed_won),
    deposits_taken: asNum(row.deposits_taken),
    cash_collected: asNum(row.cash_collected),
    revenue_generated: asNum(row.revenue_generated),
    deposit_collected: asNum(row.deposit_collected),
    revenue_predicted: asNum(row.revenue_predicted),
    avg_revenue_per_deal_acv: asNum(row.avg_revenue_per_deal_acv),
    avg_cash_per_deal_aov: asNum(row.avg_cash_per_deal_aov),
    avg_days_to_close: asNum(row.avg_days_to_close),
    show_rate: asNum(row.show_rate),
    close_rate: asNum(row.close_rate),
    prospect_to_close_rate: asNum(row.prospect_to_close_rate),
    occ_rate: asNum(row.occ_rate),
    collection_rate: asNum(row.collection_rate),
    forecast_90d_remaining: asNum(row.forecast_90d_remaining),
    is_legacy_data: asBool(row.is_legacy_data),
  };
}

function toCloserCallRow(row: Record<string, unknown>): CloserCallRow {
  return {
    prospect_email_lc: asStr(row.prospect_email_lc),
    prospect_name: asStr(row.prospect_name),
    setter_owner: asStr(row.setter_owner),
    calendly_setter_name: asStr(row.calendly_setter_name),
    call_outcome: asStr(row.call_outcome),
    call_date_time: asStr(row.call_date_time),
    appointment_date: asDate(row.appointment_date),
    final_marketing_flow: asStr(row.final_marketing_flow),
    is_show_up: asBool(row.is_show_up),
    is_deal: asBool(row.is_deal),
    is_deposit: asBool(row.is_deposit),
    is_canceled: asBool(row.is_canceled),
    is_rescheduled: asBool(row.is_rescheduled),
    is_ghosted: asBool(row.is_ghosted),
    not_taken_category: asStr(row.not_taken_category),
    cash_collected: asNum(row.cash_collected),
    revenue_generated: asNum(row.revenue_generated),
  };
}

// =====================================================================
// Queries
// =====================================================================

export async function getCloserPerformance(args: {
  from: string;
  to: string;
  /** Default false — legacy era rows have a different methodology. */
  includeLegacy?: boolean;
}): Promise<CloserRow[]> {
  const includeLegacy = args.includeLegacy ?? false;
  const [rows] = await bq().query({
    query: `
      SELECT *
      FROM ${MART_CLOSER_WEEKLY_PERFORMANCE}
      WHERE appt_date BETWEEN DATE(@from) AND DATE(@to)
        AND (@include_legacy OR is_legacy_data = FALSE)
      ORDER BY appt_date DESC, closer_name`,
    params: { from: args.from, to: args.to, include_legacy: includeLegacy },
    types: { from: "STRING", to: "STRING", include_legacy: "BOOL" },
  });
  return (rows as Record<string, unknown>[]).map(toCloserRow);
}

/** Closer drill-in: all that closer's calls in the period.
 *  Matches on the prefix of `closer_owner` email (the mart strips the
 *  email to `closer_name = initcap(email_prefix)`). */
export async function getCallsForCloser(args: {
  closerName: string;
  from: string;
  to: string;
}): Promise<CloserCallRow[]> {
  const [rows] = await bq().query({
    query: `
      SELECT
        prospect_email_lc, prospect_name,
        setter_owner, calendly_setter_name,
        call_outcome, call_date_time,
        DATE(appointment_date_time) AS appointment_date,
        final_marketing_flow,
        is_show_up, is_deal, is_deposit,
        is_canceled, is_rescheduled, is_ghosted,
        not_taken_category,
        cash_collected, revenue_generated
      FROM ${INT_CALLS_ENRICHED}
      WHERE appointment_date_time IS NOT NULL
        AND DATE(appointment_date_time) BETWEEN DATE(@from) AND DATE(@to)
        AND INITCAP(
          REGEXP_REPLACE(
            TRIM(SPLIT(LOWER(closer_owner), '@')[SAFE_OFFSET(0)]),
            r'\\s+',
            ' '
          )
        ) = @closer_name
      ORDER BY appointment_date_time DESC`,
    params: { closer_name: args.closerName, from: args.from, to: args.to },
    types: { closer_name: "STRING", from: "STRING", to: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toCloserCallRow);
}

// =====================================================================
// Aggregation: roll per-day rows up to one row per closer.
// =====================================================================

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export function aggregateByCloser(rows: CloserRow[]): CloserAggregate[] {
  const map = new Map<string, CloserAggregate>();
  for (const r of rows) {
    let agg = map.get(r.closer_name);
    if (!agg) {
      agg = {
        closer_name: r.closer_name,
        days_active: 0,
        calls_on_the_calendar: 0,
        prospects_on_the_calendar: 0,
        dispositioned_prospects: 0,
        calls_held: 0,
        unique_calls_held: 0,
        deals_closed_won: 0,
        deposits_taken: 0,
        cash_collected: 0,
        revenue_generated: 0,
        deposit_collected: 0,
        revenue_predicted: 0,
        forecast_90d_remaining: 0,
        acv: null,
        aov: null,
        show_rate: null,
        close_rate: null,
        prospect_to_close_rate: null,
        collection_rate: null,
        has_legacy: false,
      };
      map.set(r.closer_name, agg);
    }
    agg.days_active += 1;
    agg.calls_on_the_calendar += r.calls_on_the_calendar ?? 0;
    agg.prospects_on_the_calendar += r.prospects_on_the_calendar ?? 0;
    agg.dispositioned_prospects += r.dispositioned_prospects ?? 0;
    agg.calls_held += r.calls_held ?? 0;
    agg.unique_calls_held += r.unique_calls_held ?? 0;
    agg.deals_closed_won += r.deals_closed_won ?? 0;
    agg.deposits_taken += r.deposits_taken ?? 0;
    agg.cash_collected += r.cash_collected ?? 0;
    agg.revenue_generated += r.revenue_generated ?? 0;
    agg.deposit_collected += r.deposit_collected ?? 0;
    agg.revenue_predicted += r.revenue_predicted ?? 0;
    agg.forecast_90d_remaining += r.forecast_90d_remaining ?? 0;
    if (r.is_legacy_data) agg.has_legacy = true;
  }
  // Recompute derived rates from totals (NOT avg-of-daily-rates).
  for (const a of map.values()) {
    a.acv = div(a.revenue_generated, a.deals_closed_won);
    a.aov = div(a.cash_collected, a.deals_closed_won);
    a.show_rate = div(a.unique_calls_held, a.dispositioned_prospects);
    a.close_rate = div(a.deals_closed_won, a.unique_calls_held);
    a.prospect_to_close_rate = div(
      a.deals_closed_won,
      a.prospects_on_the_calendar,
    );
    a.collection_rate = div(a.cash_collected, a.revenue_generated);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.cash_collected - a.cash_collected,
  );
}

/** Period-wide totals across every closer (for the hero strip). */
export type CloserTotals = {
  closer_count: number;
  prospects_on_the_calendar: number;
  unique_calls_held: number;
  deals_closed_won: number;
  cash_collected: number;
  revenue_generated: number;
  show_rate: number | null;
  close_rate: number | null;
  aov: number | null;
};

export function computeCloserTotals(rows: CloserRow[]): CloserTotals {
  let prospects = 0,
    dispositioned = 0,
    uniqueCallsHeld = 0,
    deals = 0,
    cash = 0,
    revenue = 0;
  const closers = new Set<string>();
  for (const r of rows) {
    closers.add(r.closer_name);
    prospects += r.prospects_on_the_calendar ?? 0;
    dispositioned += r.dispositioned_prospects ?? 0;
    uniqueCallsHeld += r.unique_calls_held ?? 0;
    deals += r.deals_closed_won ?? 0;
    cash += r.cash_collected ?? 0;
    revenue += r.revenue_generated ?? 0;
  }
  return {
    closer_count: closers.size,
    prospects_on_the_calendar: prospects,
    unique_calls_held: uniqueCallsHeld,
    deals_closed_won: deals,
    cash_collected: cash,
    revenue_generated: revenue,
    show_rate: div(uniqueCallsHeld, dispositioned),
    close_rate: div(deals, uniqueCallsHeld),
    aov: div(cash, deals),
  };
}
