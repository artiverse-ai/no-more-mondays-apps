// Live data fetchers for the Weekly Report dashboard. Pulls from
// dbt_tuddin.mart_webinar_events and dbt_tuddin.int_calls_enriched and
// returns the same shapes that the static report data used to provide.
//
// The hand-written commentary (context banner, strategic insights) stays
// hardcoded — that's editorial, not a query.

import { bq } from "./bq";

const MART = "`no-more-mondays-analytics.dbt_tuddin.mart_webinar_events`";
const CALLS = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// ─── shared helpers ─────────────────────────────────────────────────────

function isoDate(d: Date | string): string {
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}

function unwrap<T>(v: T | { value: T } | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null && "value" in v) {
    return (v as { value: T }).value;
  }
  return v as T;
}

function num(v: unknown): number {
  const u = unwrap(v);
  if (u === null || u === undefined) return 0;
  return typeof u === "number" ? u : Number(u);
}

const fmtInt = (n: number) =>
  Math.round(n).toLocaleString("en-US");
const fmtUsd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");
const fmtUsd2 = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (frac: number, digits = 1) =>
  `${(frac * 100).toFixed(digits)}%`;
const fmtX = (n: number) =>
  `${n.toFixed(2)}×`;

// ─── types — same shapes the page already renders ──────────────────────

export type WebinarRow = {
  webinarDate: string;
  totalRegistrants: number;
  metaRegistrants: number;
  manychatRegistrants: number;
  setterRegistrants: number;
  otherOrganicRegistrants: number;
  uniqueAttendees: number;
  pitchedAttendees: number;
  regToAttendRate: number;
  attendToPitchedRate: number;
  totalWebinarAdSpend: number;
  webinarRegAdSpend: number;
  lpPageViews: number;
  lpOptInRate: number;
  paidCpr: number;
  blendedCpr: number;
  blendedCpa: number;
  blendedCpbc: number;
  callsBooked: number;
  callsBookedActive: number;
  dealsClosed: number;
  cashCollected: number;
  roasCash: number;
  roasRevenue: number;
  cac: number;
  reactivationPoolSize: number;
  reactivationsAttended: number;
  reactivationsBooked: number;
};

export type WeekFunnel = {
  prospects: number;
  prosD: number;
  setterDQ: number;
  closerDQ: number;
  prosSQ: number;
  showsSQ: number;
  showsCQ: number;
  deals: number;
  cash: number;
  revenue: number;
};

export type CloserOverallRow = {
  closer: string;
  prospects: number;
  prosD: number;
  sDQ: number;
  cDQ: number;
  prosSQ: number;
  showsSQ: number;
  showsCQ: number;
  deals: number;
  cash: number;
};

export type CloserPerWebinarRow = {
  closer: string;
  prospects: number;
  prosSQ: number;
  showsSQ: number;
  showsCQ: number;
  deals: number;
};

export type CloserWoWRow = {
  closer: string;
  thisDeals: number;
  thisCash: number;
  priorDeals: number;
  priorCash: number;
};

export type BookingModeRow = {
  source: "Webinar Booked" | "Setter Booked" | "Other";
  prospects: number;
  prosSQ: number;
  showsSQ: number;
  showsCQ: number;
  deals: number;
  cash: number;
};

export type SetterModeRow = {
  setter: string;
  mode: "Setter" | "Webinar";
  prosSQ: number;
  showsSQ: number;
  deals: number;
  cash: number;
};

// ─── fetchers ───────────────────────────────────────────────────────────

/**
 * Most recent 3 webinars with webinar_date <= weekEnd.
 *
 * When `sameWeekdayOnly` is true (used for Thursday midweek snapshots),
 * the result is constrained to the same DAYOFWEEK as the most recent
 * webinar in the window — so a Thu midweek report compares Wed-vs-Wed,
 * not Wed-vs-Sun-vs-Wed.
 */
export async function fetchWebinarComparison(
  weekEnd: string,
  sameWeekdayOnly = false,
): Promise<WebinarRow[]> {
  const [rows] = await bq().query({
    query: `WITH latest AS (
        SELECT MAX(webinar_date) AS d FROM ${MART} WHERE webinar_date <= DATE(@weekEnd)
      )
      SELECT
        webinar_date, total_registrants, meta_registrants, manychat_registrants,
        setter_registrants, other_organic_registrants,
        unique_attendees, pitched_attendees, reg_to_attend_rate, attend_to_pitched_rate,
        total_webinar_ad_spend, webinar_reg_ad_spend, lp_page_views, lp_opt_in_rate,
        paid_cpr,
        SAFE_DIVIDE(total_webinar_ad_spend, total_registrants) AS blended_cpr,
        blended_cpa, blended_cpbc,
        calls_booked, calls_booked_active, deals_closed, cash_collected,
        roas_cash, roas_revenue, cac,
        reactivation_pool_size, reactivations_attended, reactivations_booked
      FROM ${MART}
      WHERE webinar_date <= DATE(@weekEnd)
        AND (
          NOT @sameWeekday
          OR EXTRACT(DAYOFWEEK FROM webinar_date) =
             EXTRACT(DAYOFWEEK FROM (SELECT d FROM latest))
        )
      ORDER BY webinar_date DESC
      LIMIT 3`,
    params: { weekEnd, sameWeekday: sameWeekdayOnly },
    types: { weekEnd: "STRING", sameWeekday: "BOOL" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    webinarDate: String(unwrap(r.webinar_date) ?? ""),
    totalRegistrants: num(r.total_registrants),
    metaRegistrants: num(r.meta_registrants),
    manychatRegistrants: num(r.manychat_registrants),
    setterRegistrants: num(r.setter_registrants),
    otherOrganicRegistrants: num(r.other_organic_registrants),
    uniqueAttendees: num(r.unique_attendees),
    pitchedAttendees: num(r.pitched_attendees),
    regToAttendRate: num(r.reg_to_attend_rate),
    attendToPitchedRate: num(r.attend_to_pitched_rate),
    totalWebinarAdSpend: num(r.total_webinar_ad_spend),
    webinarRegAdSpend: num(r.webinar_reg_ad_spend),
    lpPageViews: num(r.lp_page_views),
    lpOptInRate: num(r.lp_opt_in_rate),
    paidCpr: num(r.paid_cpr),
    blendedCpr: num(r.blended_cpr),
    blendedCpa: num(r.blended_cpa),
    blendedCpbc: num(r.blended_cpbc),
    callsBooked: num(r.calls_booked),
    callsBookedActive: num(r.calls_booked_active),
    dealsClosed: num(r.deals_closed),
    cashCollected: num(r.cash_collected),
    roasCash: num(r.roas_cash),
    roasRevenue: num(r.roas_revenue),
    cac: num(r.cac),
    reactivationPoolSize: num(r.reactivation_pool_size),
    reactivationsAttended: num(r.reactivations_attended),
    reactivationsBooked: num(r.reactivations_booked),
  }));
}

/** Funnel totals for one week. */
export async function fetchWeekFunnel(
  start: string,
  end: string,
): Promise<WeekFunnel> {
  const [rows] = await bq().query({
    query: `SELECT
        COUNT(DISTINCT prospect_email_lc) AS prospects,
        COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)) AS pros_d,
        COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)) AS setter_dq,
        COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)) AS closer_dq,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL)) AS shows_cq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
        SUM(IF(is_deal, cash_collected, 0)) AS cash,
        SUM(IF(is_deal, revenue_generated, 0)) AS revenue
      FROM ${CALLS}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)`,
    params: { start, end },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows as Record<string, unknown>[])[0] ?? {};
  return {
    prospects: num(r.prospects),
    prosD: num(r.pros_d),
    setterDQ: num(r.setter_dq),
    closerDQ: num(r.closer_dq),
    prosSQ: num(r.pros_sq),
    showsSQ: num(r.shows_sq),
    showsCQ: num(r.shows_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    revenue: num(r.revenue),
  };
}

/** Per-closer breakdown for a date range (appointment_date_time basis). */
export async function fetchCloserOverall(
  start: string,
  end: string,
): Promise<CloserOverallRow[]> {
  const [rows] = await bq().query({
    query: `SELECT closer_owner AS closer,
        COUNT(DISTINCT prospect_email_lc) AS prospects,
        COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)) AS pros_d,
        COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)) AS s_dq,
        COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)) AS c_dq,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL)) AS shows_cq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
        SUM(IF(is_deal, cash_collected, 0)) AS cash
      FROM ${CALLS}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND closer_owner IS NOT NULL
      GROUP BY closer_owner
      ORDER BY deals DESC, cash DESC`,
    params: { start, end },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    closer: String(unwrap(r.closer) ?? ""),
    prospects: num(r.prospects),
    prosD: num(r.pros_d),
    sDQ: num(r.s_dq),
    cDQ: num(r.c_dq),
    prosSQ: num(r.pros_sq),
    showsSQ: num(r.shows_sq),
    showsCQ: num(r.shows_cq),
    deals: num(r.deals),
    cash: num(r.cash),
  }));
}

/** Per-closer breakdown scoped to one webinar (booking_week_sun). */
export async function fetchCloserPerWebinar(
  webinarDate: string,
): Promise<CloserPerWebinarRow[]> {
  const [rows] = await bq().query({
    query: `SELECT closer_owner AS closer,
        COUNT(DISTINCT prospect_email_lc) AS prospects,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL)) AS shows_cq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals
      FROM ${CALLS}
      WHERE booking_week_sun = DATE(@date)
        AND closer_owner IS NOT NULL
      GROUP BY closer_owner
      ORDER BY deals DESC, prospects DESC`,
    params: { date: webinarDate },
    types: { date: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    closer: String(unwrap(r.closer) ?? ""),
    prospects: num(r.prospects),
    prosSQ: num(r.pros_sq),
    showsSQ: num(r.shows_sq),
    showsCQ: num(r.shows_cq),
    deals: num(r.deals),
  }));
}

/** Closer WoW — this week + prior week side by side. */
export async function fetchCloserWoW(
  thisStart: string,
  thisEnd: string,
  priorStart: string,
  priorEnd: string,
): Promise<CloserWoWRow[]> {
  const [rows] = await bq().query({
    query: `WITH
      this_wk AS (
        SELECT closer_owner AS closer,
          COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
          SUM(IF(is_deal, cash_collected, 0)) AS cash
        FROM ${CALLS}
        WHERE DATE(appointment_date_time) BETWEEN DATE(@thisStart) AND DATE(@thisEnd)
          AND closer_owner IS NOT NULL
        GROUP BY closer_owner
      ),
      prior_wk AS (
        SELECT closer_owner AS closer,
          COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
          SUM(IF(is_deal, cash_collected, 0)) AS cash
        FROM ${CALLS}
        WHERE DATE(appointment_date_time) BETWEEN DATE(@priorStart) AND DATE(@priorEnd)
          AND closer_owner IS NOT NULL
        GROUP BY closer_owner
      )
      SELECT
        COALESCE(t.closer, p.closer) AS closer,
        COALESCE(t.deals, 0) AS this_deals,
        COALESCE(t.cash, 0) AS this_cash,
        COALESCE(p.deals, 0) AS prior_deals,
        COALESCE(p.cash, 0) AS prior_cash
      FROM this_wk t FULL OUTER JOIN prior_wk p USING(closer)
      ORDER BY this_deals DESC, this_cash DESC`,
    params: { thisStart, thisEnd, priorStart, priorEnd },
    types: {
      thisStart: "STRING",
      thisEnd: "STRING",
      priorStart: "STRING",
      priorEnd: "STRING",
    },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    closer: String(unwrap(r.closer) ?? ""),
    thisDeals: num(r.this_deals),
    thisCash: num(r.this_cash),
    priorDeals: num(r.prior_deals),
    priorCash: num(r.prior_cash),
  }));
}

/** Booking-mode split (webinar / setter / other). */
export async function fetchBookingMode(
  start: string,
  end: string,
): Promise<BookingModeRow[]> {
  const [rows] = await bq().query({
    query: `SELECT
        CASE
          WHEN is_webinar_flow THEN 'Webinar Booked'
          WHEN is_setter_flow THEN 'Setter Booked'
          ELSE 'Other'
        END AS source,
        COUNT(DISTINCT prospect_email_lc) AS prospects,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL)) AS shows_cq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
        SUM(IF(is_deal, cash_collected, 0)) AS cash
      FROM ${CALLS}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
      GROUP BY source
      ORDER BY prospects DESC`,
    params: { start, end },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    source: String(unwrap(r.source) ?? "Other") as BookingModeRow["source"],
    prospects: num(r.prospects),
    prosSQ: num(r.pros_sq),
    showsSQ: num(r.shows_sq),
    showsCQ: num(r.shows_cq),
    deals: num(r.deals),
    cash: num(r.cash),
  }));
}

/** Per-setter, per-mode show rate / volume / deals. */
export async function fetchSetterPerformance(
  start: string,
  end: string,
): Promise<SetterModeRow[]> {
  const [rows] = await bq().query({
    query: `SELECT
        setter_owner AS setter,
        CASE WHEN is_setter_flow THEN 'Setter' WHEN is_webinar_flow THEN 'Webinar' ELSE 'Other' END AS mode,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
        SUM(IF(is_deal, cash_collected, 0)) AS cash
      FROM ${CALLS}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND setter_owner IS NOT NULL
        AND (is_setter_flow OR is_webinar_flow)
      GROUP BY setter, mode
      HAVING pros_sq > 0
      ORDER BY (SELECT SUM(x) FROM UNNEST([pros_sq]) AS x) DESC, setter, mode`,
    params: { start, end },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    setter: String(unwrap(r.setter) ?? ""),
    mode: String(unwrap(r.mode) ?? "Setter") as SetterModeRow["mode"],
    prosSQ: num(r.pros_sq),
    showsSQ: num(r.shows_sq),
    deals: num(r.deals),
    cash: num(r.cash),
  }));
}

// ─── high-level orchestrator ────────────────────────────────────────────

export type WeeklyReportData = {
  webinars: WebinarRow[];
  thisWeekFunnel: WeekFunnel;
  priorWeekFunnel: WeekFunnel;
  closerOverall: CloserOverallRow[];
  closerWoW: CloserWoWRow[];
  perWebinarMostRecent: CloserPerWebinarRow[];
  perWebinarSecond: CloserPerWebinarRow[];
  bookingMode: BookingModeRow[];
  setterPerformance: SetterModeRow[];
  window: {
    thisStart: string;
    thisEnd: string;
    priorStart: string;
    priorEnd: string;
    webinarDates: string[];
  };
};

/**
 * Pull every section of the report for the (start, end) window.
 *
 * Cadence:
 *   - Monday recap: Mon → Sun (7 days, previous full week)
 *   - Thursday midweek check: Sun → Wed (4 days, current week through yesterday)
 *
 * If `end` is omitted it defaults to start+6d (the 7-day recap shape) so
 * older callers that just passed a week-start keep working.
 *
 * Prior-period (for WoW) is the same window shape shifted back 7 days, so
 * a 4-day Thursday window compares to the prior week's same 4 days.
 */
export async function fetchWeeklyReport(
  weekStart: Date | string,
  weekEnd?: Date | string,
  reportType: "weekly_recap" | "midweek_check" = "weekly_recap",
): Promise<WeeklyReportData> {
  const start = typeof weekStart === "string" ? weekStart : isoDate(weekStart);
  const startDate = new Date(start + "T00:00:00Z");
  const endDate =
    weekEnd === undefined
      ? new Date(startDate.getTime() + 6 * 86400000)
      : typeof weekEnd === "string"
      ? new Date(weekEnd + "T00:00:00Z")
      : weekEnd;
  const end = isoDate(endDate);
  const priorStartDate = new Date(startDate.getTime() - 7 * 86400000);
  const priorEndDate = new Date(endDate.getTime() - 7 * 86400000);
  const priorStart = isoDate(priorStartDate);
  const priorEnd = isoDate(priorEndDate);

  const [
    webinars,
    thisWeekFunnel,
    priorWeekFunnel,
    closerOverall,
    closerWoW,
    bookingMode,
    setterPerformance,
  ] = await Promise.all([
    fetchWebinarComparison(end, reportType === "midweek_check"),
    fetchWeekFunnel(start, end),
    fetchWeekFunnel(priorStart, priorEnd),
    fetchCloserOverall(start, end),
    fetchCloserWoW(start, end, priorStart, priorEnd),
    fetchBookingMode(start, end),
    fetchSetterPerformance(start, end),
  ]);

  // Per-webinar tables for the two most-recent webinars in the window
  // (matches the original report: May 3 + May 6).
  const [perWebinarMostRecent, perWebinarSecond] = await Promise.all([
    webinars[1] ? fetchCloserPerWebinar(webinars[1].webinarDate) : Promise.resolve([]),
    webinars[2] ? fetchCloserPerWebinar(webinars[2].webinarDate) : Promise.resolve([]),
  ]);

  return {
    webinars,
    thisWeekFunnel,
    priorWeekFunnel,
    closerOverall,
    closerWoW,
    perWebinarMostRecent,
    perWebinarSecond,
    bookingMode,
    setterPerformance,
    window: {
      thisStart: start,
      thisEnd: end,
      priorStart,
      priorEnd,
      webinarDates: webinars.map((w) => w.webinarDate),
    },
  };
}

// ─── render-shape adapters ──────────────────────────────────────────────

// Convert a WebinarRow's pivot of 3 webinars into the TOP_OF_FUNNEL row
// structure the page already renders. Output mirrors the prior static
// data.ts shape exactly so the JSX doesn't need to change.

export type ComparisonRow =
  | {
      kind: "data";
      label: string;
      tip?: string;
      values: [string, string, string];
      classes?: [string, string, string];
    }
  | { kind: "divider"; label: string };

const fmtDelta = (n: number) => (n > 0 ? `+${fmtInt(n)}` : `${fmtInt(n)}`);
void fmtDelta;

function tripleStr(
  rows: WebinarRow[],
  field: keyof WebinarRow,
  fmt: (n: number) => string = (n) => fmtInt(n),
): [string, string, string] {
  const get = (i: number) => {
    const r = rows[i];
    if (!r) return "—";
    return fmt(Number(r[field] ?? 0));
  };
  return [get(0), get(1), get(2)];
}

export function buildTopOfFunnelRows(webinars: WebinarRow[]): ComparisonRow[] {
  // webinars[0] = latest. Mirrors the static data.ts ordering: latest first.
  return [
    { kind: "divider", label: "Registration" },
    { kind: "data", label: "Ad Spend (paid promo)", tip: "Ad spend attributed to this webinar promo window.\nSource: mart_webinar_events.total_webinar_ad_spend",
      values: tripleStr(webinars, "totalWebinarAdSpend", fmtUsd) },
    { kind: "data", label: "LP Page Views", tip: "Source: mart_webinar_events.lp_page_views",
      values: tripleStr(webinars, "lpPageViews", fmtInt) },
    { kind: "data", label: "LP Opt-in Rate", tip: "lp_opt_ins / lp_page_views\nSource: mart_webinar_events.lp_opt_in_rate",
      values: tripleStr(webinars, "lpOptInRate", (n) => fmtPct(n)) },
    { kind: "data", label: "Total Registrants (GHL)", tip: "Source: mart_webinar_events.total_registrants",
      values: tripleStr(webinars, "totalRegistrants", fmtInt) },
    { kind: "data", label: "↳ Meta (paid)", tip: "Source: mart_webinar_events.meta_registrants",
      values: tripleStr(webinars, "metaRegistrants", fmtInt) },
    { kind: "data", label: "↳ ManyChat", tip: "Source: mart_webinar_events.manychat_registrants",
      values: tripleStr(webinars, "manychatRegistrants", fmtInt) },
    { kind: "data", label: "↳ Setter", tip: "Source: mart_webinar_events.setter_registrants",
      values: tripleStr(webinars, "setterRegistrants", fmtInt) },
    { kind: "data", label: "↳ Other Organic", tip: "Source: mart_webinar_events.other_organic_registrants",
      values: tripleStr(webinars, "otherOrganicRegistrants", fmtInt) },
    { kind: "divider", label: "Attendance" },
    { kind: "data", label: "Unique Attendees", tip: "Source: mart_webinar_events.unique_attendees",
      values: tripleStr(webinars, "uniqueAttendees", fmtInt) },
    { kind: "data", label: "Pitched (>25 min)", tip: "Source: mart_webinar_events.pitched_attendees",
      values: tripleStr(webinars, "pitchedAttendees", fmtInt) },
    { kind: "data", label: "Attend Rate", tip: "unique_attendees / total_registrants\nSource: mart_webinar_events.reg_to_attend_rate",
      values: tripleStr(webinars, "regToAttendRate", (n) => fmtPct(n)) },
    { kind: "data", label: "Pitch Rate", tip: "Source: mart_webinar_events.attend_to_pitched_rate",
      values: tripleStr(webinars, "attendToPitchedRate", (n) => fmtPct(n)) },
    { kind: "divider", label: "Cost Efficiency" },
    { kind: "data", label: "Cost / Reg (Paid)", tip: "Source: mart_webinar_events.paid_cpr",
      values: tripleStr(webinars, "paidCpr", fmtUsd2) },
    { kind: "data", label: "Cost / Reg (Blended)", tip: "ad_spend / total_registrants",
      values: tripleStr(webinars, "blendedCpr", fmtUsd2) },
    { kind: "data", label: "Cost / Attendee", tip: "Source: mart_webinar_events.blended_cpa",
      values: tripleStr(webinars, "blendedCpa", fmtUsd2) },
    { kind: "divider", label: "Sales — Webinar-Attributed" },
    { kind: "data", label: "Calls Booked", tip: "Source: mart_webinar_events.calls_booked",
      values: tripleStr(webinars, "callsBooked", fmtInt) },
    { kind: "data", label: "Calls on Calendar", tip: "Source: mart_webinar_events.calls_booked_active",
      values: tripleStr(webinars, "callsBookedActive", fmtInt) },
    { kind: "data", label: "Cost / Booked Call", tip: "Source: mart_webinar_events.blended_cpbc",
      values: tripleStr(webinars, "blendedCpbc", fmtUsd2) },
    { kind: "data", label: "Deals", tip: "Source: mart_webinar_events.deals_closed",
      values: tripleStr(webinars, "dealsClosed", fmtInt) },
    { kind: "data", label: "Cash", tip: "Source: mart_webinar_events.cash_collected",
      values: tripleStr(webinars, "cashCollected", fmtUsd) },
    { kind: "data", label: "ROAS (Cash)", tip: "Source: mart_webinar_events.roas_cash",
      values: tripleStr(webinars, "roasCash", (n) => fmtX(n)) },
    { kind: "data", label: "ROAS (Revenue)", tip: "Source: mart_webinar_events.roas_revenue",
      values: tripleStr(webinars, "roasRevenue", (n) => fmtX(n)) },
    { kind: "data", label: "CAC", tip: "ad_spend / deals_closed\nSource: mart_webinar_events.cac",
      values: tripleStr(webinars, "cac", fmtUsd2) },
  ];
}

// Channel mix is just the latest webinar's channel breakdown.
export function buildChannelMix(latest: WebinarRow | undefined) {
  if (!latest) return [];
  const total = latest.totalRegistrants || 1;
  return [
    { name: "Meta (paid)", count: latest.metaRegistrants, pct: (latest.metaRegistrants / total) * 100, color: "blue" as const },
    { name: "Other organic", count: latest.otherOrganicRegistrants, pct: (latest.otherOrganicRegistrants / total) * 100, color: "green" as const },
    { name: "ManyChat", count: latest.manychatRegistrants, pct: (latest.manychatRegistrants / total) * 100, color: "amber" as const },
    { name: "Setter", count: latest.setterRegistrants, pct: (latest.setterRegistrants / total) * 100, color: "purple" as const },
  ];
}

export function buildChannelMixTrend(webinars: WebinarRow[]) {
  const pct = (n: number, t: number) => (t > 0 ? fmtPct(n / t) : "—");
  return [
    { name: "Meta paid", may10: pct(webinars[0]?.metaRegistrants ?? 0, webinars[0]?.totalRegistrants ?? 0), may6: pct(webinars[1]?.metaRegistrants ?? 0, webinars[1]?.totalRegistrants ?? 0), may3: pct(webinars[2]?.metaRegistrants ?? 0, webinars[2]?.totalRegistrants ?? 0) },
    { name: "ManyChat", may10: pct(webinars[0]?.manychatRegistrants ?? 0, webinars[0]?.totalRegistrants ?? 0), may6: pct(webinars[1]?.manychatRegistrants ?? 0, webinars[1]?.totalRegistrants ?? 0), may3: pct(webinars[2]?.manychatRegistrants ?? 0, webinars[2]?.totalRegistrants ?? 0) },
    { name: "Setter", may10: pct(webinars[0]?.setterRegistrants ?? 0, webinars[0]?.totalRegistrants ?? 0), may6: pct(webinars[1]?.setterRegistrants ?? 0, webinars[1]?.totalRegistrants ?? 0), may3: pct(webinars[2]?.setterRegistrants ?? 0, webinars[2]?.totalRegistrants ?? 0), dn: (webinars[0]?.setterRegistrants ?? 0) < (webinars[1]?.setterRegistrants ?? 0) },
    { name: "Other organic", may10: pct(webinars[0]?.otherOrganicRegistrants ?? 0, webinars[0]?.totalRegistrants ?? 0), may6: pct(webinars[1]?.otherOrganicRegistrants ?? 0, webinars[1]?.totalRegistrants ?? 0), may3: pct(webinars[2]?.otherOrganicRegistrants ?? 0, webinars[2]?.totalRegistrants ?? 0) },
  ];
}

export function buildReactivationFunnel(webinars: WebinarRow[]) {
  return webinars.map((w, idx) => {
    const attendRate = w.reactivationPoolSize > 0 ? w.reactivationsAttended / w.reactivationPoolSize : 0;
    const bookRate = w.reactivationsAttended > 0 ? w.reactivationsBooked / w.reactivationsAttended : 0;
    return {
      webinar: idx === 0 ? `${w.webinarDate} (latest)` : w.webinarDate,
      pool: fmtInt(w.reactivationPoolSize),
      attended: fmtInt(w.reactivationsAttended),
      attendRate: fmtPct(attendRate),
      booked: fmtInt(w.reactivationsBooked),
      bookRate: fmtPct(bookRate),
      highlight: idx === 0,
    };
  });
}

// Format helpers consumed by page.tsx for KPI cards / WoW etc.
export const fmt = {
  int: fmtInt,
  usd: fmtUsd,
  usd2: fmtUsd2,
  pct: fmtPct,
  x: fmtX,
};

// ─── more shape builders ────────────────────────────────────────────────

export function buildFunnelStages(f: WeekFunnel) {
  const total = f.prospects || 1;
  return [
    {
      label: "Prospects", value: f.prospects, width: 100, color: "blue",
      tip: "COUNT DISTINCT prospect_email_lc\nSource: int_calls_enriched",
    },
    {
      label: "Prospects (SQ)", value: f.prosSQ, width: (f.prosSQ / total) * 100, color: "blue",
      tip: "COUNT DISTINCT WHERE is_show_rate_eligible",
    },
    {
      label: "Shows (SQ)", value: f.showsSQ, width: (f.showsSQ / total) * 100, color: "green",
      tip: "COUNT DISTINCT WHERE is_show_up",
    },
    {
      label: "Shows (CQ)", value: f.showsCQ, width: (f.showsCQ / total) * 100, color: "amber",
      tip: "COUNT DISTINCT WHERE is_close_rate_eligible",
    },
    {
      label: "Deals", value: f.deals, width: (f.deals / total) * 100, color: "purple",
      tip: "COUNT DISTINCT WHERE is_deal\nSource: int_calls_enriched",
    },
  ];
}

export function buildFunnelConnectors(f: WeekFunnel) {
  const setterFallout = f.prosD - f.prosSQ; // Setter DQ + rescheduled etc
  const showRate = f.prosSQ > 0 ? f.showsSQ / f.prosSQ : 0;
  const noShows = f.prosSQ - f.showsSQ;
  const closerFallout = f.showsSQ - f.showsCQ;
  const closeRate = f.showsCQ > 0 ? f.deals / f.showsCQ : 0;
  const lostFollowup = f.showsCQ - f.deals;
  return [
    { rate: `${f.prosSQ} Prospects (SQ)`, drop: `−${setterFallout} (Setter DQ + reschedule/other)` },
    { rate: `Show Rate ${fmtPct(showRate)}`, drop: `−${noShows} no-shows / cancels`, rateColor: "green" as const },
    { rate: `${f.showsCQ} Shows (CQ)`, drop: `−${closerFallout} Closer DQ` },
    { rate: `Close Rate ${fmtPct(closeRate)}`, drop: `−${lostFollowup} lost / follow-up`, rateColor: "green" as const },
  ];
}

export function buildKpiCards(t: WeekFunnel, p: WeekFunnel) {
  const aov = t.deals > 0 ? t.cash / t.deals : 0;
  const acv = t.deals > 0 ? t.revenue / t.deals : 0;
  const priorAov = p.deals > 0 ? p.cash / p.deals : 0;
  const priorAcv = p.deals > 0 ? p.revenue / p.deals : 0;
  const collectionRate = t.revenue > 0 ? t.cash / t.revenue : 0;
  const priorCollection = p.revenue > 0 ? p.cash / p.revenue : 0;
  const setterDqRate = t.prosD > 0 ? t.setterDQ / t.prosD : 0;
  const priorSetterDqRate = p.prosD > 0 ? p.setterDQ / p.prosD : 0;

  const delta = (a: number, b: number, fmtFn = fmtUsd) => {
    if (b === 0) return `vs ${fmtFn(b)} prior wk`;
    const pct = ((a - b) / b) * 100;
    const arrow = a > b ? "↑" : a < b ? "↓" : "→";
    return `${arrow} ${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs ${fmtFn(b)} prior wk`;
  };
  const ppDelta = (a: number, b: number) => {
    const pp = (a - b) * 100;
    const arrow = pp > 0 ? "↑" : pp < 0 ? "↓" : "→";
    return `${arrow} ${pp > 0 ? "+" : ""}${pp.toFixed(1)}pp vs ${fmtPct(b)} prior wk`;
  };

  return [
    {
      label: "Cash Collected", value: fmtUsd(t.cash),
      change: delta(t.cash, p.cash), changeClass: t.cash >= p.cash ? "up" : "dn",
      tip: "SUM cash_collected WHERE is_deal\nSource: int_calls_enriched",
    },
    {
      label: "Revenue (TCV)", value: fmtUsd(t.revenue),
      change: delta(t.revenue, p.revenue), changeClass: t.revenue >= p.revenue ? "up" : "dn",
      tip: "SUM revenue_generated WHERE is_deal",
    },
    {
      label: "AOV", value: fmtUsd(aov),
      change: delta(aov, priorAov), changeClass: aov >= priorAov ? "up" : "dn",
      tip: `Cash / Deals · ${fmtUsd(t.cash)} / ${t.deals}`,
    },
    {
      label: "ACV", value: fmtUsd(acv),
      change: delta(acv, priorAcv), changeClass: acv >= priorAcv ? "up" : "dn",
      tip: `Revenue / Deals · ${fmtUsd(t.revenue)} / ${t.deals}`,
    },
    {
      label: "Cash Collection Rate", value: fmtPct(collectionRate),
      change: ppDelta(collectionRate, priorCollection),
      changeClass: collectionRate >= priorCollection ? "up" : "dn",
      tip: `Cash / Revenue · ${fmtUsd(t.cash)} / ${fmtUsd(t.revenue)}`,
    },
    {
      label: "Setter DQ Rate", value: fmtPct(setterDqRate),
      change: ppDelta(setterDqRate, priorSetterDqRate),
      // For DQ rate, DOWN is good — so flip the class.
      changeClass: setterDqRate <= priorSetterDqRate ? "up" : "dn",
      tip: `Setter DQ / Prospects (D'd)\n= ${t.setterDQ} / ${t.prosD}`,
    },
  ];
}

export type WoWRow =
  | {
      kind: "data";
      label: string;
      tip?: string;
      thisWeek: string;
      prior: string;
      change: string;
      changeClass?: "up" | "dn" | "nt";
      thisWeekClass?: string;
    }
  | { kind: "divider"; label: string };

export function buildWoWComparison(t: WeekFunnel, p: WeekFunnel): WoWRow[] {
  const pctChange = (a: number, b: number) => {
    if (b === 0) return a === 0 ? "→ 0%" : "↑ new";
    const pct = ((a - b) / b) * 100;
    const arrow = a > b ? "↑" : a < b ? "↓" : "→";
    return `${arrow} ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  };
  const ppChange = (a: number, b: number) => {
    const pp = (a - b) * 100;
    const arrow = pp > 0 ? "↑" : pp < 0 ? "↓" : "→";
    return `${arrow} ${pp > 0 ? "+" : ""}${pp.toFixed(1)}pp`;
  };
  const cls = (a: number, b: number, lowerIsBetter = false): "up" | "dn" | "nt" => {
    if (a === b) return "nt";
    if (lowerIsBetter) return a < b ? "up" : "dn";
    return a > b ? "up" : "dn";
  };

  const showRateT = t.prosSQ > 0 ? t.showsSQ / t.prosSQ : 0;
  const showRateP = p.prosSQ > 0 ? p.showsSQ / p.prosSQ : 0;
  const closeRateT = t.showsCQ > 0 ? t.deals / t.showsCQ : 0;
  const closeRateP = p.showsCQ > 0 ? p.deals / p.showsCQ : 0;
  const aovT = t.deals > 0 ? t.cash / t.deals : 0;
  const aovP = p.deals > 0 ? p.cash / p.deals : 0;
  const acvT = t.deals > 0 ? t.revenue / t.deals : 0;
  const acvP = p.deals > 0 ? p.revenue / p.deals : 0;
  const ccrT = t.revenue > 0 ? t.cash / t.revenue : 0;
  const ccrP = p.revenue > 0 ? p.cash / p.revenue : 0;

  return [
    { kind: "divider", label: "Funnel Volume" },
    { kind: "data", label: "Prospects", thisWeek: fmtInt(t.prospects), prior: fmtInt(p.prospects), change: pctChange(t.prospects, p.prospects), changeClass: cls(t.prospects, p.prospects) },
    { kind: "data", label: "Prospects (D'd)", thisWeek: fmtInt(t.prosD), prior: fmtInt(p.prosD), change: pctChange(t.prosD, p.prosD), changeClass: cls(t.prosD, p.prosD) },
    { kind: "data", label: "Setter DQ", thisWeek: fmtInt(t.setterDQ), prior: fmtInt(p.setterDQ), change: pctChange(t.setterDQ, p.setterDQ), changeClass: cls(t.setterDQ, p.setterDQ, true) },
    { kind: "data", label: "Closer DQ", thisWeek: fmtInt(t.closerDQ), prior: fmtInt(p.closerDQ), change: pctChange(t.closerDQ, p.closerDQ), changeClass: cls(t.closerDQ, p.closerDQ, true) },
    { kind: "data", label: "Prospects (SQ)", thisWeek: fmtInt(t.prosSQ), prior: fmtInt(p.prosSQ), change: pctChange(t.prosSQ, p.prosSQ), changeClass: cls(t.prosSQ, p.prosSQ) },
    { kind: "data", label: "Shows (SQ)", thisWeek: fmtInt(t.showsSQ), prior: fmtInt(p.showsSQ), change: pctChange(t.showsSQ, p.showsSQ), changeClass: cls(t.showsSQ, p.showsSQ) },
    { kind: "data", label: "Shows (CQ)", thisWeek: fmtInt(t.showsCQ), prior: fmtInt(p.showsCQ), change: pctChange(t.showsCQ, p.showsCQ), changeClass: cls(t.showsCQ, p.showsCQ) },
    { kind: "data", label: "Deals", thisWeek: fmtInt(t.deals), prior: fmtInt(p.deals), change: pctChange(t.deals, p.deals), changeClass: cls(t.deals, p.deals) },
    { kind: "divider", label: "Rates" },
    { kind: "data", label: "Show Rate", thisWeek: fmtPct(showRateT), prior: fmtPct(showRateP), change: ppChange(showRateT, showRateP), changeClass: cls(showRateT, showRateP) },
    { kind: "data", label: "Close Rate", thisWeek: fmtPct(closeRateT), prior: fmtPct(closeRateP), change: ppChange(closeRateT, closeRateP), changeClass: cls(closeRateT, closeRateP) },
    { kind: "divider", label: "Revenue" },
    { kind: "data", label: "Cash", thisWeek: fmtUsd(t.cash), prior: fmtUsd(p.cash), change: pctChange(t.cash, p.cash), changeClass: cls(t.cash, p.cash) },
    { kind: "data", label: "Revenue (TCV)", thisWeek: fmtUsd(t.revenue), prior: fmtUsd(p.revenue), change: pctChange(t.revenue, p.revenue), changeClass: cls(t.revenue, p.revenue) },
    { kind: "data", label: "AOV", thisWeek: fmtUsd(aovT), prior: fmtUsd(aovP), change: pctChange(aovT, aovP), changeClass: cls(aovT, aovP) },
    { kind: "data", label: "ACV", thisWeek: fmtUsd(acvT), prior: fmtUsd(acvP), change: pctChange(acvT, acvP), changeClass: cls(acvT, acvP) },
    { kind: "data", label: "Cash Collection Rate", thisWeek: fmtPct(ccrT), prior: fmtPct(ccrP), change: ppChange(ccrT, ccrP), changeClass: cls(ccrT, ccrP) },
  ];
}

export function buildCloserOverallTotal(f: WeekFunnel) {
  const showRate = f.prosSQ > 0 ? f.showsSQ / f.prosSQ : 0;
  const closeRate = f.showsCQ > 0 ? f.deals / f.showsCQ : 0;
  return {
    label: "All Sales",
    prospects: fmtInt(f.prospects),
    prosD: fmtInt(f.prosD),
    sDQ: fmtInt(f.setterDQ),
    cDQ: fmtInt(f.closerDQ),
    prosSQ: fmtInt(f.prosSQ),
    showsSQ: fmtInt(f.showsSQ),
    showsCQ: fmtInt(f.showsCQ),
    deals: fmtInt(f.deals),
    cash: fmtUsd(f.cash),
    show: fmtPct(showRate),
    close: fmtPct(closeRate),
  };
}

export function buildCloserOverall(rows: CloserOverallRow[]) {
  const max = (k: keyof CloserOverallRow) =>
    Math.max(0, ...rows.map((r) => Number(r[k] ?? 0)));
  const maxDeals = max("deals");
  const maxCash = max("cash");
  const maxShow = Math.max(
    ...rows.map((r) => (r.prosSQ > 0 ? r.showsSQ / r.prosSQ : 0)),
  );
  const maxClose = Math.max(
    ...rows.map((r) => (r.showsCQ > 0 ? r.deals / r.showsCQ : 0)),
  );

  return rows.map((r) => {
    const show = r.prosSQ > 0 ? r.showsSQ / r.prosSQ : 0;
    const close = r.showsCQ > 0 ? r.deals / r.showsCQ : 0;
    return {
      closer: r.closer,
      prospects: fmtInt(r.prospects),
      prosD: fmtInt(r.prosD),
      sDQ: fmtInt(r.sDQ),
      cDQ: fmtInt(r.cDQ),
      prosSQ: fmtInt(r.prosSQ),
      showsSQ: fmtInt(r.showsSQ),
      showsCQ: fmtInt(r.showsCQ),
      deals: fmtInt(r.deals),
      cash: fmtUsd(r.cash),
      show: fmtPct(show),
      close: fmtPct(close),
      upDeals: r.deals === maxDeals && maxDeals > 0,
      upCash: r.cash === maxCash && maxCash > 0,
      upShow: show === maxShow && maxShow > 0,
      upClose: close === maxClose && maxClose > 0,
      dnDeals: r.deals === 0,
      dnCash: r.cash === 0,
      dnClose: close === 0,
    };
  });
}

export function buildCloserWoW(rows: CloserWoWRow[]) {
  return rows.map((r) => ({
    closer: r.closer,
    deals: r.thisDeals > r.priorDeals ? `${r.thisDeals} ↑` : r.thisDeals < r.priorDeals ? `${r.thisDeals} ↓` : `${r.thisDeals}`,
    cash: fmtUsd(r.thisCash),
    priorDeals: fmtInt(r.priorDeals),
    priorCash: fmtUsd(r.priorCash),
    upDeals: r.thisDeals > r.priorDeals,
    upCash: r.thisCash > r.priorCash,
    dnDeals: r.thisDeals < r.priorDeals,
    dnCash: r.thisCash < r.priorCash,
  }));
}

export function buildCloserPerWebinar(rows: CloserPerWebinarRow[]) {
  const maxDeals = Math.max(0, ...rows.map((r) => r.deals));
  return rows.map((r) => {
    const close = r.showsCQ > 0 ? r.deals / r.showsCQ : null;
    return {
      closer: r.closer,
      prospects: fmtInt(r.prospects),
      prosSQ: fmtInt(r.prosSQ),
      showsSQ: fmtInt(r.showsSQ),
      showsCQ: fmtInt(r.showsCQ),
      deals: fmtInt(r.deals),
      close: close === null ? "—" : fmtPct(close),
      upDeals: r.deals === maxDeals && maxDeals > 0,
      upClose: close !== null && close >= 1,
      dnClose: close === 0,
      ntClose: close === null,
    };
  });
}

export function buildBookingMode(rows: BookingModeRow[]) {
  const maxShow = Math.max(
    ...rows.map((r) => (r.prosSQ > 0 ? r.showsSQ / r.prosSQ : 0)),
  );
  return rows.map((r) => {
    const show = r.prosSQ > 0 ? r.showsSQ / r.prosSQ : 0;
    const close = r.showsCQ > 0 ? r.deals / r.showsCQ : 0;
    return {
      source: r.source,
      prospects: fmtInt(r.prospects),
      prosSQ: fmtInt(r.prosSQ),
      showsSQ: fmtInt(r.showsSQ),
      showRate: fmtPct(show),
      showsCQ: fmtInt(r.showsCQ),
      deals: fmtInt(r.deals),
      cash: fmtUsd(r.cash),
      close: fmtPct(close),
      upShow: show === maxShow && maxShow > 0,
    };
  });
}

export function buildSetterPerformance(rows: SetterModeRow[]) {
  // Group by setter, fold the two modes together.
  const grouped = new Map<string, SetterModeRow[]>();
  for (const r of rows) {
    if (!grouped.has(r.setter)) grouped.set(r.setter, []);
    grouped.get(r.setter)!.push(r);
  }
  const setters = [...grouped.entries()].map(([name, modeRows]) => {
    const totalProsSq = modeRows.reduce((s, r) => s + r.prosSQ, 0);
    const totalShowsSq = modeRows.reduce((s, r) => s + r.showsSQ, 0);
    const totalDeals = modeRows.reduce((s, r) => s + r.deals, 0);
    const totalCash = modeRows.reduce((s, r) => s + r.cash, 0);
    const sr = totalProsSq > 0 ? totalShowsSq / totalProsSq : 0;
    const clearsSr = sr >= 0.8;
    const clearsVol = totalProsSq >= 20;
    const bonusLabel = clearsSr && clearsVol ? "✓ Bonus" : clearsSr ? "✗ Vol" : clearsVol ? "✗ SR" : "✗ SR+Vol";
    const tone: "up" | "amb" | "dn" =
      clearsSr && clearsVol ? "up" : clearsSr || clearsVol ? "amb" : "dn";
    const tip =
      `Overall SR: ${totalShowsSq}/${totalProsSq} = ${fmtPct(sr)} — ${clearsSr ? "clears" : "below"} 80%.\n` +
      `Pros (SQ): ${totalProsSq} — ${clearsVol ? "≥ 20 threshold" : "below 20 threshold"}.`;
    return {
      name,
      rows: ["Setter", "Webinar"].map((mode) => {
        const found = modeRows.find((r) => r.mode === mode);
        const showVal = found ? (found.prosSQ > 0 ? found.showsSQ / found.prosSQ : 0) : 0;
        return {
          mode,
          prosSQ: fmtInt(found?.prosSQ ?? 0),
          showsSQ: fmtInt(found?.showsSQ ?? 0),
          show: found ? fmtPct(showVal) : "—",
          deals: fmtInt(found?.deals ?? 0),
          cash: fmtUsd(found?.cash ?? 0),
          upShow: found ? showVal >= 0.75 : false,
          dnShow: found ? showVal < 0.5 && found.prosSQ > 0 : false,
        };
      }),
      bonus: { label: bonusLabel, tone, tip },
      combined: `${name} Combined: ${totalProsSq} Pros (SQ) · ${totalShowsSq} Shows (SQ) · ${fmtPct(sr)} SR · ${totalDeals} deals · ${fmtUsd(totalCash)}`,
    };
  });
  // Highest volume first.
  return setters.sort((a, b) => {
    const av = a.rows.reduce((s, r) => s + parseInt(r.prosSQ.replace(/,/g, "")), 0);
    const bv = b.rows.reduce((s, r) => s + parseInt(r.prosSQ.replace(/,/g, "")), 0);
    return bv - av;
  });
}
