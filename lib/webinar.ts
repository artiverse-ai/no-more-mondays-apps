// BigQuery data layer for the Webinar Performance dashboard (/dashboards/webinar).
//
// The webinar marts live in `no-more-mondays-analytics.dbt_tuddin`, a different
// dataset from the calendar views in `nmm_calendar`. Like lib/closers.ts we
// hard-code the production location regardless of the BQ_PROJECT / BQ_DATASET
// env vars (those only steer the calendar app).
//
// The Vercel service account therefore needs `roles/bigquery.dataViewer` on the
// `dbt_tuddin` dataset in addition to `nmm_calendar` (see docs/DEPLOY.md).

import { bq } from "./bq";

const MART_WEBINAR_EVENTS =
  "`no-more-mondays-analytics.dbt_tuddin.mart_webinar_events`";
const INT_CALLS_ENRICHED =
  "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// =====================================================================
// Types
// =====================================================================

export type WebinarEvent = {
  webinar_date: string; // YYYY-MM-DD
  webinar_day: string;
  booking_week_sun: string; // YYYY-MM-DD
  week_start: string; // YYYY-MM-DD
  data_era: string;
  is_legacy: boolean;

  lp_page_views: number | null;
  lp_opt_ins: number | null;
  lp_opt_in_rate: number | null;
  lp_form_submissions: number | null;

  ad_spend: number | null;
  meta_impressions: number | null;
  meta_clicks: number | null;
  meta_ctr: number | null;
  meta_cvr: number | null;
  meta_cpl: number | null;

  total_registrants: number | null;
  meta_registrants: number | null;
  tiktok_registrants: number | null;
  manychat_registrants: number | null;
  setter_registrants: number | null;
  other_organic_registrants: number | null;

  unique_attendees: number | null;
  pitched_attendees: number | null;
  reg_to_attend_rate: number | null;
  attend_to_pitched_rate: number | null;

  calls_booked: number | null;
  calls_booked_active: number | null;
  calls_held: number | null;
  webinar_deposits: number | null;
  deals_closed: number | null;

  cash_collected: number | null;
  deposit_collected: number | null;
  revenue_generated: number | null;
  revenue_predicted: number | null;

  paid_cpr: number | null;
  blended_cpr: number | null;
  blended_cpa: number | null;
  blended_cpbc: number | null;
  blended_cost_per_held_call: number | null;
  cac: number | null;
  roas_cash: number | null;
  roas_revenue: number | null;
  pitch_to_book_rate: number | null;

  dbt_updated_at: string | null; // ISO timestamp

  /** Every column from the mart row, flattened to plain JS — for the raw viewer. */
  raw: Record<string, unknown>;
};

export type WebinarCall = {
  prospect_email_lc: string | null;
  prospect_name: string | null;
  closer_owner: string | null;
  setter_owner: string | null;
  calendly_setter_name: string | null;
  call_outcome: string | null;
  call_date_time: string | null; // ISO timestamp
  booking_week_sun: string; // YYYY-MM-DD
  final_marketing_flow: string | null;
  is_call_held: boolean;
  is_deal: boolean;
  is_deposit: boolean;
  not_taken_category: string | null;
  cash_collected: number | null;
  revenue_generated: number | null;
};

export type FunnelStage = { label: string; value: number };

export type WebinarKpis = {
  spend: number;
  registrants: number;
  attendees: number;
  booked: number;
  held: number;
  deals: number;
  cash: number;
  revenue: number;
  roas: number | null; // cash / spend
  cac: number | null; // spend / deal
};

// =====================================================================
// BigQuery value normalization
//
// The BigQuery client wraps DATE / DATETIME / TIMESTAMP / TIME values as objects
// with a `.value` string, and NUMERIC / BIGNUMERIC as Big.js instances. Flatten
// everything to plain JS so the rest of the app never sees wrapper objects.
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
  // DATE columns arrive as { value: "2026-05-06" }; tolerate timestamps too.
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

function plainify(v: unknown): unknown {
  const u = unwrap(v);
  // A Big.js instance (NUMERIC) — stringify so JSON.stringify renders a number.
  if (u != null && typeof u === "object") return String(u);
  return u;
}

function toWebinarEvent(row: Record<string, unknown>): WebinarEvent {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) raw[k] = plainify(v);
  return {
    webinar_date: asDate(row.webinar_date),
    webinar_day: asStr(row.webinar_day) ?? "",
    booking_week_sun: asDate(row.booking_week_sun),
    week_start: asDate(row.week_start),
    data_era: asStr(row.data_era) ?? "",
    is_legacy: asBool(row.is_legacy),

    lp_page_views: asNum(row.lp_page_views),
    lp_opt_ins: asNum(row.lp_opt_ins),
    lp_opt_in_rate: asNum(row.lp_opt_in_rate),
    lp_form_submissions: asNum(row.lp_form_submissions),

    ad_spend: asNum(row.ad_spend),
    meta_impressions: asNum(row.meta_impressions),
    meta_clicks: asNum(row.meta_clicks),
    meta_ctr: asNum(row.meta_ctr),
    meta_cvr: asNum(row.meta_cvr),
    meta_cpl: asNum(row.meta_cpl),

    total_registrants: asNum(row.total_registrants),
    meta_registrants: asNum(row.meta_registrants),
    tiktok_registrants: asNum(row.tiktok_registrants),
    manychat_registrants: asNum(row.manychat_registrants),
    setter_registrants: asNum(row.setter_registrants),
    other_organic_registrants: asNum(row.other_organic_registrants),

    unique_attendees: asNum(row.unique_attendees),
    pitched_attendees: asNum(row.pitched_attendees),
    reg_to_attend_rate: asNum(row.reg_to_attend_rate),
    attend_to_pitched_rate: asNum(row.attend_to_pitched_rate),

    calls_booked: asNum(row.calls_booked),
    calls_booked_active: asNum(row.calls_booked_active),
    calls_held: asNum(row.calls_held),
    webinar_deposits: asNum(row.webinar_deposits),
    deals_closed: asNum(row.deals_closed),

    cash_collected: asNum(row.cash_collected),
    deposit_collected: asNum(row.deposit_collected),
    revenue_generated: asNum(row.revenue_generated),
    revenue_predicted: asNum(row.revenue_predicted),

    paid_cpr: asNum(row.paid_cpr),
    blended_cpr: asNum(row.blended_cpr),
    blended_cpa: asNum(row.blended_cpa),
    blended_cpbc: asNum(row.blended_cpbc),
    blended_cost_per_held_call: asNum(row.blended_cost_per_held_call),
    cac: asNum(row.cac),
    roas_cash: asNum(row.roas_cash),
    roas_revenue: asNum(row.roas_revenue),
    pitch_to_book_rate: asNum(row.pitch_to_book_rate),

    dbt_updated_at: asStr(row.dbt_updated_at),
    raw,
  };
}

function toWebinarCall(row: Record<string, unknown>): WebinarCall {
  return {
    prospect_email_lc: asStr(row.prospect_email_lc),
    prospect_name: asStr(row.prospect_name),
    closer_owner: asStr(row.closer_owner),
    setter_owner: asStr(row.setter_owner),
    calendly_setter_name: asStr(row.calendly_setter_name),
    call_outcome: asStr(row.call_outcome),
    call_date_time: asStr(row.call_date_time),
    booking_week_sun: asDate(row.booking_week_sun),
    final_marketing_flow: asStr(row.final_marketing_flow),
    is_call_held: asBool(row.is_call_held),
    is_deal: asBool(row.is_deal),
    is_deposit: asBool(row.is_deposit),
    not_taken_category: asStr(row.not_taken_category),
    cash_collected: asNum(row.cash_collected),
    revenue_generated: asNum(row.revenue_generated),
  };
}

// =====================================================================
// Queries
// =====================================================================

export async function getWebinars(): Promise<WebinarEvent[]> {
  const [rows] = await bq().query({
    query: `SELECT * FROM ${MART_WEBINAR_EVENTS} ORDER BY webinar_date DESC`,
  });
  return (rows as Record<string, unknown>[]).map(toWebinarEvent);
}

export async function getWebinar(date: string): Promise<WebinarEvent | null> {
  const [rows] = await bq().query({
    query: `SELECT * FROM ${MART_WEBINAR_EVENTS} WHERE webinar_date = DATE(@date) LIMIT 1`,
    params: { date },
    types: { date: "STRING" },
  });
  const r = (rows as Record<string, unknown>[])[0];
  return r ? toWebinarEvent(r) : null;
}

export async function getCallsForBookingWeek(
  week: string,
): Promise<WebinarCall[]> {
  const [rows] = await bq().query({
    query: `
      SELECT
        prospect_email_lc, prospect_name, closer_owner, setter_owner, calendly_setter_name,
        call_outcome, call_date_time, booking_week_sun, final_marketing_flow,
        is_call_held, is_deal, is_deposit, not_taken_category,
        cash_collected, revenue_generated
      FROM ${INT_CALLS_ENRICHED}
      WHERE booking_week_sun = DATE(@week)
      ORDER BY call_date_time DESC`,
    params: { week },
    types: { week: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map(toWebinarCall);
}

// =====================================================================
// Derived helpers (ported from the v0 static dashboard)
// =====================================================================

/** Calls attributable to this webinar: same booking week + matching marketing flow. */
export function callsForWebinar(
  calls: WebinarCall[],
  w: WebinarEvent,
): WebinarCall[] {
  const day = w.webinar_day;
  return calls.filter((c) => {
    if (c.booking_week_sun !== w.booking_week_sun) return false;
    const f = c.final_marketing_flow;
    if (day === "Wednesday")
      return f === "Wednesday Webinar" || f === "Post-Attendee Webinar Typeform";
    if (day === "Sunday" || day === "Monthly Workshop")
      return f === "Webinar" || f === "Post-Attendee Webinar Typeform";
    return false; // legacy era — no call-level data
  });
}

export function computeKpis(rows: WebinarEvent[]): WebinarKpis {
  let spend = 0,
    registrants = 0,
    attendees = 0,
    booked = 0,
    held = 0,
    deals = 0,
    cash = 0,
    revenue = 0;
  for (const r of rows) {
    spend += r.ad_spend ?? 0;
    registrants += r.total_registrants ?? 0;
    attendees += r.unique_attendees ?? 0;
    booked += r.calls_booked ?? 0;
    held += r.calls_held ?? 0;
    deals += r.deals_closed ?? 0;
    cash += r.cash_collected ?? 0;
    revenue += r.revenue_generated ?? 0;
  }
  return {
    spend,
    registrants,
    attendees,
    booked,
    held,
    deals,
    cash,
    revenue,
    roas: spend > 0 ? cash / spend : null,
    cac: deals > 0 ? spend / deals : null,
  };
}

/** All eight funnel stages, top → bottom. Missing counts are shown as 0. */
export function funnelStages(w: WebinarEvent): FunnelStage[] {
  return [
    { label: "Page views", value: w.lp_page_views ?? 0 },
    { label: "Opt-ins", value: w.lp_opt_ins ?? 0 },
    { label: "Registered", value: w.total_registrants ?? 0 },
    { label: "Attended", value: w.unique_attendees ?? 0 },
    { label: "Pitched", value: w.pitched_attendees ?? 0 },
    { label: "Booked call", value: w.calls_booked ?? 0 },
    { label: "Held call", value: w.calls_held ?? 0 },
    { label: "Deal closed", value: w.deals_closed ?? 0 },
  ];
}

export function filterWebinars(
  rows: WebinarEvent[],
  f: { day?: string; era?: string; from?: string; to?: string },
): WebinarEvent[] {
  return rows.filter((r) => {
    if (f.day && f.day !== "all" && r.webinar_day !== f.day) return false;
    if (f.era && f.era !== "all" && r.data_era !== f.era) return false;
    if (f.from && r.webinar_date < f.from) return false;
    if (f.to && r.webinar_date > f.to) return false;
    return true;
  });
}

export function sortWebinars(
  rows: WebinarEvent[],
  key: string,
  dir: "asc" | "desc",
): WebinarEvent[] {
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
