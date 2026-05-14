// BigQuery data layer for the Webinar Performance dashboard (/dashboards/webinar).
//
// The webinar marts live in `no-more-mondays-analytics.dbt_tuddin`, a different
// dataset from the calendar views in `nmm_calendar`. Like lib/closers.ts we
// hard-code the production location regardless of the BQ_PROJECT / BQ_DATASET
// env vars (those only steer the calendar app).
//
// Aligned with analytics-repo PR #42 (webinar marketing refactor) and PR #43
// (sales side + new CEO mart). See docs/sales-ceo-dashboard-update-2026-05.md
// for the verbatim column-change list.

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

  // ----- Landing page / opt-in -----
  lp_page_views: number | null;
  lp_opt_ins: number | null;
  lp_opt_in_rate: number | null;
  lp_form_submissions: number | null;

  // ----- Marketing (PR #42) -----
  // total_webinar_ad_spend = webinar_reg_ad_spend + webinar_hammer_them_ad_spend
  // (dbt-tested invariant). Sunday-day spend is 50/50-split between that
  // Sunday's webinar and the following Wednesday's, so these can be fractional.
  total_webinar_ad_spend: number | null;
  webinar_reg_ad_spend: number | null;
  webinar_hammer_them_ad_spend: number | null;
  /** Meta frequency for the Hammer-Them webinar campaign. NULL for legacy rows. */
  frequency_webinar_hammer_them: number | null;
  /** Webinar registration campaigns only (Hammer-Them excluded); may be fractional on Sunday-split rows. */
  meta_impressions: number | null;
  meta_link_clicks: number | null;
  meta_ctr: number | null;
  meta_cvr: number | null;
  meta_cpl: number | null;

  // ----- Registration sources -----
  total_registrants: number | null;
  meta_registrants: number | null;
  tiktok_registrants: number | null;
  manychat_registrants: number | null;
  setter_registrants: number | null;
  other_organic_registrants: number | null;

  // ----- Attendance -----
  unique_attendees: number | null;
  pitched_attendees: number | null;
  reg_to_attend_rate: number | null;
  attend_to_pitched_rate: number | null;
  /** cash_collected / unique_attendees (PR #42). */
  cash_collected_per_attendee: number | null;
  /** revenue_generated / unique_attendees (PR #42). */
  contract_value_per_attendee: number | null;

  // ----- Sales / pipeline (PR #43) -----
  calls_booked: number | null;
  calls_booked_active: number | null;
  /** Show-ups. Renamed from calls_held; now EXCLUDES Setter DQ rows (bug fix). */
  shows: number | null;
  /** Closer-qualified shows (excludes Setter DQ AND Closer DQ). NULL for legacy. */
  qualified_shows: number | null;
  webinar_deposits: number | null;
  deals_closed: number | null;

  cash_collected: number | null;
  deposit_collected: number | null;
  revenue_generated: number | null;
  revenue_predicted: number | null;

  // ----- Unit economics -----
  paid_cpr: number | null;
  blended_cpa: number | null;
  blended_cpbc: number | null;
  /** total_webinar_ad_spend / calls_booked_active (PR #43). */
  blended_cpbc_active: number | null;
  /** Renamed from blended_cost_per_held_call; same formula intent. */
  blended_cost_per_show: number | null;
  /** total_webinar_ad_spend / qualified_shows (PR #43). NULL for legacy. */
  blended_cost_per_qualified_show: number | null;
  cac: number | null;
  roas_cash: number | null;
  roas_revenue: number | null;
  /** "Live ROAS": running cash by deal-prospect emails / total_webinar_ad_spend.
   *  Grows as payment-plan installments come in. NULL for legacy rows. */
  roas_cash_running: number | null;
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
  // PR #43: `is_show_up` is the truth (call held AND not a Setter DQ).
  // The old `is_call_held` flag was deprecated because it incorrectly
  // counted Setter DQ rows — we never render a "held" pill again.
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

export type FunnelStage = { label: string; value: number };

export type WebinarKpis = {
  spend: number;
  registrants: number;
  attendees: number;
  booked: number;
  shows: number;
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

    total_webinar_ad_spend: asNum(row.total_webinar_ad_spend),
    webinar_reg_ad_spend: asNum(row.webinar_reg_ad_spend),
    webinar_hammer_them_ad_spend: asNum(row.webinar_hammer_them_ad_spend),
    frequency_webinar_hammer_them: asNum(row.frequency_webinar_hammer_them),
    meta_impressions: asNum(row.meta_impressions),
    meta_link_clicks: asNum(row.meta_link_clicks),
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
    cash_collected_per_attendee: asNum(row.cash_collected_per_attendee),
    contract_value_per_attendee: asNum(row.contract_value_per_attendee),

    calls_booked: asNum(row.calls_booked),
    calls_booked_active: asNum(row.calls_booked_active),
    shows: asNum(row.shows),
    qualified_shows: asNum(row.qualified_shows),
    webinar_deposits: asNum(row.webinar_deposits),
    deals_closed: asNum(row.deals_closed),

    cash_collected: asNum(row.cash_collected),
    deposit_collected: asNum(row.deposit_collected),
    revenue_generated: asNum(row.revenue_generated),
    revenue_predicted: asNum(row.revenue_predicted),

    paid_cpr: asNum(row.paid_cpr),
    blended_cpa: asNum(row.blended_cpa),
    blended_cpbc: asNum(row.blended_cpbc),
    blended_cpbc_active: asNum(row.blended_cpbc_active),
    blended_cost_per_show: asNum(row.blended_cost_per_show),
    blended_cost_per_qualified_show: asNum(row.blended_cost_per_qualified_show),
    cac: asNum(row.cac),
    roas_cash: asNum(row.roas_cash),
    roas_revenue: asNum(row.roas_revenue),
    roas_cash_running: asNum(row.roas_cash_running),
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
        is_show_up, is_deal, is_deposit,
        is_canceled, is_rescheduled, is_ghosted,
        not_taken_category,
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
    shows = 0,
    deals = 0,
    cash = 0,
    revenue = 0;
  for (const r of rows) {
    spend += r.total_webinar_ad_spend ?? 0;
    registrants += r.total_registrants ?? 0;
    attendees += r.unique_attendees ?? 0;
    booked += r.calls_booked ?? 0;
    shows += r.shows ?? 0;
    deals += r.deals_closed ?? 0;
    cash += r.cash_collected ?? 0;
    revenue += r.revenue_generated ?? 0;
  }
  return {
    spend,
    registrants,
    attendees,
    booked,
    shows,
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
    { label: "Shows", value: w.shows ?? 0 },
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

// =====================================================================
// Granularity rollup for time-series charts.
// =====================================================================

/** Aggregated time-series point for chart rendering. */
export type WebinarPoint = {
  /** Sortable YYYY-MM-DD key for the bucket start. */
  bucketDate: string;
  /** Pretty label for the X axis (e.g. "May 3", "May 2026", "2026"). */
  label: string;
  webinar_count: number;
  total_webinar_ad_spend: number;
  cash_collected: number;
  revenue_generated: number;
  shows: number;
  deals_closed: number;
  calls_booked: number;
  unique_attendees: number;
  /** Per-bucket ROAS — recomputed from bucket totals, NOT averaged. */
  roas_cash: number | null;
};

// Accepts the broader Granularity union from components/ui/granularity-picker
// so the page can pass through `?gran=` without narrowing. "day" is treated
// as "webinar" here — webinars don't happen daily.
type WebinarGran = "day" | "webinar" | "week" | "month" | "year";

function toSundayStart(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

function bucketKey(date: string, gran: WebinarGran): string {
  if (gran === "week") return toSundayStart(date);
  if (gran === "month") return date.slice(0, 7) + "-01";
  if (gran === "year") return date.slice(0, 4) + "-01-01";
  return date; // webinar / day → one bucket per event
}

function formatBucketLabel(bucketDate: string, gran: WebinarGran): string {
  const dt = new Date(bucketDate + "T00:00:00Z");
  if (gran === "year") {
    return dt.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });
  }
  if (gran === "month") {
    return dt.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  // webinar / week — same compact "May 3" label; the section heading
  // tells the user what they're looking at.
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Roll a webinar set up to the chosen granularity, sorted ascending by date. */
export function aggregateWebinarByGran(
  rows: WebinarEvent[],
  gran: WebinarGran,
): WebinarPoint[] {
  const map = new Map<string, WebinarPoint>();
  for (const r of rows) {
    const key = bucketKey(r.webinar_date, gran);
    let pt = map.get(key);
    if (!pt) {
      pt = {
        bucketDate: key,
        label: formatBucketLabel(key, gran),
        webinar_count: 0,
        total_webinar_ad_spend: 0,
        cash_collected: 0,
        revenue_generated: 0,
        shows: 0,
        deals_closed: 0,
        calls_booked: 0,
        unique_attendees: 0,
        roas_cash: null,
      };
      map.set(key, pt);
    }
    pt.webinar_count += 1;
    pt.total_webinar_ad_spend += r.total_webinar_ad_spend ?? 0;
    pt.cash_collected += r.cash_collected ?? 0;
    pt.revenue_generated += r.revenue_generated ?? 0;
    pt.shows += r.shows ?? 0;
    pt.deals_closed += r.deals_closed ?? 0;
    pt.calls_booked += r.calls_booked ?? 0;
    pt.unique_attendees += r.unique_attendees ?? 0;
  }
  // Recompute ROAS per bucket from totals (NOT average-of-per-webinar).
  for (const pt of map.values()) {
    pt.roas_cash =
      pt.total_webinar_ad_spend > 0
        ? pt.cash_collected / pt.total_webinar_ad_spend
        : null;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.bucketDate.localeCompare(b.bucketDate),
  );
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
