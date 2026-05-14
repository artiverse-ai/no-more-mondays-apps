// BigQuery data layer for the Setter Performance dashboard
// (/dashboards/setter).
//
// No dedicated mart exists for setter-level rollups, so we GROUP BY
// COALESCE(setter_owner, calendly_setter_name) directly off
// int_calls_enriched. The table is small (low tens of thousands of rows)
// so the per-request scan is fine; if it grows we can add a
// mart_setter_weekly_performance upstream.

import { bq } from "./bq";

const INT_CALLS_ENRICHED =
  "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// =====================================================================
// Types
// =====================================================================

/** One row per setter, already aggregated server-side. */
export type SetterRow = {
  setter: string;
  bookings: number;
  active_bookings: number;
  dispositioned: number;
  show_ups: number;
  show_rate_eligible: number;
  setter_dq: number;
  qualified_shows: number;
  closer_dq: number;
  deals: number;
  deposits: number;
  cash_attributed: number;
  revenue_attributed: number;
  // Derived from totals
  show_rate: number | null;          // show_ups / show_rate_eligible
  setter_dq_rate: number | null;     // setter_dq / dispositioned
  closer_dq_rate: number | null;     // closer_dq / show_ups
  qualified_rate: number | null;     // qualified_shows / show_ups
  deal_rate: number | null;          // deals / qualified_shows
  cash_per_booking: number | null;   // cash_attributed / bookings
};

/** Per-setter call drill row — same shape as the closer drill row. */
export type SetterCallRow = {
  prospect_email_lc: string | null;
  prospect_name: string | null;
  closer_owner: string | null;
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
// BigQuery value normalization (parallels lib/sales.ts).
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
function asNum0(v: unknown): number {
  const u = unwrap(v);
  if (u == null || u === "") return 0;
  const n = Number(u);
  return Number.isFinite(n) ? n : 0;
}
function asNumN(v: unknown): number | null {
  const u = unwrap(v);
  if (u == null || u === "") return null;
  const n = Number(u);
  return Number.isFinite(n) ? n : null;
}
function asBool(v: unknown): boolean {
  const u = unwrap(v);
  return u === true || u === "true";
}

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

function toSetterRow(row: Record<string, unknown>): SetterRow {
  const bookings = asNum0(row.bookings);
  const show_rate_eligible = asNum0(row.show_rate_eligible);
  const show_ups = asNum0(row.show_ups);
  const setter_dq = asNum0(row.setter_dq);
  const dispositioned = asNum0(row.dispositioned);
  const qualified_shows = asNum0(row.qualified_shows);
  const closer_dq = asNum0(row.closer_dq);
  const deals = asNum0(row.deals);
  const cash_attributed = asNum0(row.cash_attributed);
  return {
    setter: asStr(row.setter) ?? "",
    bookings,
    active_bookings: asNum0(row.active_bookings),
    dispositioned,
    show_ups,
    show_rate_eligible,
    setter_dq,
    qualified_shows,
    closer_dq,
    deals,
    deposits: asNum0(row.deposits),
    cash_attributed,
    revenue_attributed: asNum0(row.revenue_attributed),
    show_rate: div(show_ups, show_rate_eligible),
    setter_dq_rate: div(setter_dq, dispositioned),
    closer_dq_rate: div(closer_dq, show_ups),
    qualified_rate: div(qualified_shows, show_ups),
    deal_rate: div(deals, qualified_shows),
    cash_per_booking: div(cash_attributed, bookings),
  };
}

function toSetterCallRow(row: Record<string, unknown>): SetterCallRow {
  return {
    prospect_email_lc: asStr(row.prospect_email_lc),
    prospect_name: asStr(row.prospect_name),
    closer_owner: asStr(row.closer_owner),
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
    cash_collected: asNumN(row.cash_collected),
    revenue_generated: asNumN(row.revenue_generated),
  };
}

// =====================================================================
// Queries
// =====================================================================

/** Per-setter rollup over a date range. Filters by `flow` if provided. */
export async function getSetterPerformance(args: {
  from: string;
  to: string;
  /** Optional final_marketing_flow filter (e.g. 'Setter Booked'). */
  flow?: string;
}): Promise<SetterRow[]> {
  const flow = args.flow || null;
  const [rows] = await bq().query({
    query: `
      SELECT
        COALESCE(setter_owner, calendly_setter_name) AS setter,
        COUNTIF(is_call_booked) AS bookings,
        COUNTIF(is_call_booked AND NOT COALESCE(is_canceled, FALSE)) AS active_bookings,
        COUNTIF(is_dispositioned) AS dispositioned,
        COUNTIF(is_show_up) AS show_ups,
        COUNTIF(is_show_rate_eligible) AS show_rate_eligible,
        COUNTIF(call_outcome = 'Setter DQ') AS setter_dq,
        COUNTIF(is_close_rate_eligible) AS qualified_shows,
        COUNTIF(call_outcome = 'Closer DQ') AS closer_dq,
        COUNTIF(is_deal) AS deals,
        COUNTIF(is_deposit) AS deposits,
        SUM(IF(is_deal, CAST(cash_collected AS NUMERIC), 0)) AS cash_attributed,
        SUM(IF(is_deal, CAST(revenue_generated AS NUMERIC), 0)) AS revenue_attributed
      FROM ${INT_CALLS_ENRICHED}
      WHERE appointment_date_time IS NOT NULL
        AND DATE(appointment_date_time) BETWEEN DATE(@from) AND DATE(@to)
        AND COALESCE(setter_owner, calendly_setter_name) IS NOT NULL
        AND (@flow IS NULL OR final_marketing_flow = @flow)
      GROUP BY setter
      HAVING bookings > 0
      ORDER BY bookings DESC`,
    params: { from: args.from, to: args.to, flow },
    types: { from: "STRING", to: "STRING", flow: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toSetterRow);
}

/** Setter drill-in: every call attributed to that setter in the period. */
export async function getCallsForSetter(args: {
  setter: string;
  from: string;
  to: string;
}): Promise<SetterCallRow[]> {
  const [rows] = await bq().query({
    query: `
      SELECT
        prospect_email_lc, prospect_name,
        closer_owner,
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
        AND COALESCE(setter_owner, calendly_setter_name) = @setter
      ORDER BY appointment_date_time DESC`,
    params: { setter: args.setter, from: args.from, to: args.to },
    types: { setter: "STRING", from: "STRING", to: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toSetterCallRow);
}

/** List of distinct final_marketing_flow values in the period — for the flow filter. */
export async function getSetterFlowOptions(args: {
  from: string;
  to: string;
}): Promise<string[]> {
  const [rows] = await bq().query({
    query: `
      SELECT DISTINCT final_marketing_flow AS flow
      FROM ${INT_CALLS_ENRICHED}
      WHERE final_marketing_flow IS NOT NULL
        AND appointment_date_time IS NOT NULL
        AND DATE(appointment_date_time) BETWEEN DATE(@from) AND DATE(@to)
        AND COALESCE(setter_owner, calendly_setter_name) IS NOT NULL
      ORDER BY flow`,
    params: { from: args.from, to: args.to },
    types: { from: "STRING", to: "STRING" },
  });
  return (rows as Record<string, unknown>[])
    .map((r) => asStr(r.flow))
    .filter((x): x is string => !!x);
}

// =====================================================================
// Period-wide totals (hero strip)
// =====================================================================

export type SetterTotals = {
  setter_count: number;
  bookings: number;
  show_ups: number;
  show_rate_eligible: number;
  setter_dq: number;
  qualified_shows: number;
  deals: number;
  cash_attributed: number;
  show_rate: number | null;
  setter_dq_rate: number | null;
  qualified_rate: number | null;
  cash_per_booking: number | null;
};

export function computeSetterTotals(rows: SetterRow[]): SetterTotals {
  let bookings = 0,
    dispositioned = 0,
    show_ups = 0,
    show_rate_eligible = 0,
    setter_dq = 0,
    qualified_shows = 0,
    deals = 0,
    cash = 0;
  for (const r of rows) {
    bookings += r.bookings;
    dispositioned += r.dispositioned;
    show_ups += r.show_ups;
    show_rate_eligible += r.show_rate_eligible;
    setter_dq += r.setter_dq;
    qualified_shows += r.qualified_shows;
    deals += r.deals;
    cash += r.cash_attributed;
  }
  return {
    setter_count: rows.length,
    bookings,
    show_ups,
    show_rate_eligible,
    setter_dq,
    qualified_shows,
    deals,
    cash_attributed: cash,
    show_rate: div(show_ups, show_rate_eligible),
    setter_dq_rate: div(setter_dq, dispositioned),
    qualified_rate: div(qualified_shows, show_ups),
    cash_per_booking: div(cash, bookings),
  };
}
