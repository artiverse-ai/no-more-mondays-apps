// New spec-driven BQ fetchers per weekly_report_metrics_sql_reference.md.
// Every SQL block here is copied verbatim (modulo bigquery client adapter)
// from the reference doc — DO NOT invent or modify. The reference is the
// single source of truth; this file is the JS binding.
//
// Companion docs:
//   - weekly_report_metrics_sql_reference.md (canonical SQL)
//   - weekly_report_build_guide.md (UI structure)
//
// Conventions:
//   - All date params are 'YYYY-MM-DD' strings.
//   - Returns shape mirrors what the rendering components expect — see
//     the type declarations at the top of each section.

import { bq } from "./bq";

// Full project.dataset.table references — these queries are NOT scoped to
// our normal nmm_calendar dataset because the source marts live in
// dbt_tuddin within the same project.
const PROJECT = process.env.BQ_PROJECT || "no-more-mondays-analytics";
const MART_WEBINAR = `\`${PROJECT}.dbt_tuddin.mart_webinar_events\``;
const MART_HL_DAILY = `\`${PROJECT}.dbt_tuddin.mart_high_level_daily\``;
const ENRICHED = `\`${PROJECT}.dbt_tuddin.int_calls_enriched\``;
const FANBASIS = `\`${PROJECT}.dbt_tuddin.stg_fanbasis_sales\``;
const META_CAMPAIGNS = `\`${PROJECT}.dbt_tuddin.stg_meta_campaigns\``;
const GHL_FORM_SUB = `\`${PROJECT}.dbt_tuddin.stg_ghl_form_submissions_flat\``;

// Internal email exclusion fragment used in every int_calls_enriched / stg_calendly query.
const EMAIL_EXCLUSION = `prospect_email_lc NOT LIKE '%@nomoremondays.io%' AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')`;

// ============================================================================
// EXPORTED SQL TEMPLATES — used by the Dev-Mode info modal so the user can
// see (and copy) the exact query that produced any KPI strip or Tab 1 card.
// These are the SAME strings the fetchers run; both point at the constants
// below so the two cannot drift.
// ============================================================================

export const SQL_AVG_WEBINAR_SHOW_RATE = `WITH last_three AS (
  SELECT unique_attendees, total_registrants
  FROM ${MART_WEBINAR}
  WHERE webinar_date <= DATE(@latest)
    AND webinar_day IN ('Sunday', 'Wednesday')
  ORDER BY webinar_date DESC
  LIMIT 3
)
SELECT SAFE_DIVIDE(SUM(unique_attendees), NULLIF(SUM(total_registrants), 0)) AS avg_webinar_show_rate
FROM last_three`;

export const SQL_PCT_TIER_ONE_LEADS = `SELECT
  SAFE_DIVIDE(SUM(tier_one_submissions), NULLIF(SUM(form_submissions), 0)) AS pct_tier_one_leads
FROM ${MART_WEBINAR}
WHERE webinar_date BETWEEN DATE(@start) AND DATE(@end)`;

export const SQL_BLENDED_CASH_ROAS = `WITH cash AS (
  -- Fanbasis + Whop money-in (stg_fanbasis_sales holds both, no platform filter)
  SELECT SUM(amount_usd) AS cash_money_in
  FROM ${FANBASIS}
  WHERE sale_date BETWEEN DATE(@start) AND DATE(@end)
    AND status = 'succeeded'
),
spend AS (
  SELECT SUM(total_ad_spend) AS total_ad_spend
  FROM ${MART_HL_DAILY}
  WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)
)
SELECT SAFE_DIVIDE(cash.cash_money_in, spend.total_ad_spend) AS blended_cash_roas
FROM cash, spend`;

export const SQL_CASH_PER_BOOKED_CALL = `WITH cash AS (
  -- Fanbasis + Whop money-in (stg_fanbasis_sales holds both, no platform filter)
  SELECT SUM(amount_usd) AS cash_money_in
  FROM ${FANBASIS}
  WHERE sale_date BETWEEN DATE(@start) AND DATE(@end)
    AND status = 'succeeded'
),
calls AS (
  SELECT SUM(total_calls_booked) AS total_calls_booked
  FROM ${MART_HL_DAILY}
  WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)
)
SELECT SAFE_DIVIDE(cash.cash_money_in, calls.total_calls_booked) AS cash_per_booked_call
FROM cash, calls`;

// stg_fanbasis_sales is named after the Fanbasis processor but actually
// contains BOTH Fanbasis (~638 rows) AND Whop (~143 rows) transactions —
// the platform column distinguishes them. We deliberately don't filter
// by platform so the card shows total money-in across both processors.
// Alias is `cash_money_in` (not `cash_fanbasis`) to avoid the misnomer.
export const SQL_SECTION_A_CASH = `SELECT SUM(amount_usd) AS cash_money_in
FROM ${FANBASIS}
WHERE sale_date BETWEEN DATE(@start) AND DATE(@end)
  AND status = 'succeeded'`;

export const SQL_SECTION_A_HL = `SELECT
  SUM(total_revenue_contracted) AS tcv,
  SUM(total_ad_spend)           AS ad_spend,
  SUM(total_deals_closed)       AS deals,
  SUM(count_pif_deals)          AS pif_deals
FROM ${MART_HL_DAILY}
WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)`;

export const SQL_OCC_CYCLE = `SELECT
  APPROX_QUANTILES(IF(close_type='OCC', booking_to_close_days, NULL), 2)[OFFSET(1)] AS median_book_to_close_occ,
  AVG(IF(close_type='OCC', booking_to_close_days, NULL))                            AS avg_book_to_close_occ,
  COUNT(IF(close_type='OCC', 1, NULL))                                              AS n_occ
FROM ${ENRICHED}
WHERE is_deal
  AND date_closed BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}`;

// Tab 3 "Latest Sales Week" money — sources from int_calls_enriched
// (closer-attributed) instead of stg_fanbasis_sales (money-in basis). The
// Overview tab still uses Fanbasis (money that hit the bank this week);
// Tab 3 needs the closer-attributed view (new deals booked this week,
// regardless of when cash collects).
export const SQL_TAB3_MONEY_CLOSER = `WITH d AS (
  SELECT
    COUNT(DISTINCT IF(is_deal,                   prospect_email_lc, NULL)) AS deals,
    COUNT(DISTINCT IF(is_deal AND is_paid_in_full, prospect_email_lc, NULL)) AS pif_deals,
    SUM(IF(is_deal, cash_collected, 0))                                   AS cash,
    SUM(IF(is_deal, revenue_generated, 0))                                AS revenue
  FROM ${ENRICHED}
  WHERE date_closed BETWEEN DATE(@start) AND DATE(@end)
    AND ${EMAIL_EXCLUSION}
)
SELECT * FROM d`;

export const SQL_FUC_CYCLE = `SELECT
  APPROX_QUANTILES(IF(close_type='FUC', first_call_to_close_days, NULL), 2)[OFFSET(1)] AS median_first_call_to_close_fuc,
  AVG(IF(close_type='FUC', first_call_to_close_days, NULL))                            AS avg_first_call_to_close_fuc,
  COUNT(IF(close_type='FUC', 1, NULL))                                                 AS n_fuc
FROM ${ENRICHED}
WHERE is_deal
  AND date_closed BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}`;

// NOTE on window convention (Taziem 2026-05-18): calls_booked is sales-week
// semantic (calls land in the sales week they're scheduled), but ad_spend is
// marketing-week semantic (when money was spent). This query uses the SALES
// window for both because the downstream Cost/Booked Call ratio needs a
// single window. A future enhancement could split into two queries — flagged
// as a TODO. Today this means the spend portion is within ±2 days of the
// "true" marketing-week spend (windows overlap heavily).
export const SQL_SECTION_B = `SELECT
  SUM(total_calls_booked)        AS total_calls_booked,
  SUM(total_calls_booked_active) AS total_calls_booked_active,
  SUM(total_ad_spend)            AS ad_spend
FROM ${MART_HL_DAILY}
WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)`;

export const SQL_SECTION_C = `SELECT
  COUNT(DISTINCT prospect_email_lc)                                              AS prospects,
  COUNT(DISTINCT IF(is_dispositioned,         prospect_email_lc, NULL))          AS prospects_dd,
  COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL))          AS setter_dq,
  COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL))          AS closer_dq,
  COUNT(DISTINCT IF(is_show_rate_eligible,    prospect_email_lc, NULL))          AS prospects_sq,
  COUNT(DISTINCT IF(is_show_up,               prospect_email_lc, NULL))          AS shows_sq,
  COUNT(DISTINCT IF(is_close_rate_eligible,   prospect_email_lc, NULL))          AS shows_cq,
  COUNT(DISTINCT IF(is_deal,                  prospect_email_lc, NULL))          AS deals,
  SUM(IF(is_deal, cash_collected,    0))                                          AS cash_int_calls,
  SUM(IF(is_deal, revenue_generated, 0))                                          AS revenue
FROM ${ENRICHED}
WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}`;

// Tab 2 — Latest Webinar comparison (3-webinar row set). @dates is an
// ARRAY<STRING> of yyyy-mm-dd values; ${'\${dates_literal}'} is substituted
// by the dev-sql resolver to "['2026-05-10','2026-05-06','2026-04-29']".
export const SQL_WEBINAR_COMPARISON = `SELECT
  FORMAT_DATE('%F', webinar_date) AS webinar_date,
  webinar_day,
  total_webinar_ad_spend, webinar_reg_ad_spend, webinar_hammer_them_ad_spend,
  lp_page_views, lp_opt_ins, lp_opt_in_rate, lp_form_submissions,
  total_registrants, meta_registrants, tiktok_registrants,
  manychat_registrants, setter_registrants, other_organic_registrants,
  unique_attendees, pitched_attendees, reg_to_attend_rate, attend_to_pitched_rate,
  paid_cpr, blended_cpa, blended_cpbc, blended_cpbc_active,
  blended_cost_per_show, blended_cost_per_qualified_show,
  meta_impressions, meta_link_clicks, meta_ctr, meta_cvr, meta_cpl,
  meta_reported_conversions,
  calls_booked, calls_booked_active,
  shows, qualified_shows, webinar_deposits, deals_closed,
  cash_collected, deposit_collected, revenue_generated,
  cash_collected_per_attendee, contract_value_per_attendee,
  roas_cash, roas_cash_running, roas_revenue, cac,
  reactivation_pool_size, reactivations_attended, reactivations_booked,
  is_reactivation_data_available
FROM ${MART_WEBINAR}
WHERE webinar_date IN (SELECT DATE(d) FROM UNNEST(@dates) AS d)
ORDER BY webinar_date DESC`;

// Tab 2 — Per-campaign Meta data with Frequency.
export const SQL_META_CAMPAIGNS = `SELECT
  campaign_name, campaign_category,
  SUM(spend_usd)                                            AS spend,
  SUM(impressions)                                          AS impressions,
  SUM(link_clicks)                                          AS link_clicks,
  SAFE_DIVIDE(SUM(impressions), MAX(reach))                 AS frequency_window,
  SUM(conversions)                                          AS conversions,
  SAFE_DIVIDE(SUM(spend_usd), NULLIF(SUM(conversions), 0))  AS cpl,
  SAFE_DIVIDE(SUM(link_clicks), NULLIF(SUM(impressions),0)) AS link_ctr,
  SAFE_DIVIDE(SUM(conversions), NULLIF(SUM(link_clicks),0)) AS link_cvr
FROM ${META_CAMPAIGNS}
WHERE date_day BETWEEN DATE(@start) AND DATE(@end)
  AND campaign_category IN ('webinar_registration', 'webinar_hammer_them')
GROUP BY 1, 2
ORDER BY spend DESC`;

// Tab 3 — Closer Performance Overall (15-col extended; Monday §9.5).
export const SQL_CLOSER_OVERALL = `SELECT
  closer_owner,
  COUNT(DISTINCT prospect_email_lc)                                              AS prospects,
  COUNT(DISTINCT IF(is_dispositioned,         prospect_email_lc, NULL))          AS prospects_dd,
  COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL))          AS setter_dq,
  COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL))          AS closer_dq,
  COUNT(DISTINCT IF(is_show_rate_eligible,    prospect_email_lc, NULL))          AS prospects_sq,
  COUNT(DISTINCT IF(is_show_up,               prospect_email_lc, NULL))          AS shows,
  COUNT(DISTINCT IF(is_close_rate_eligible,   prospect_email_lc, NULL))          AS qualified_shows,
  COUNT(DISTINCT IF(is_deal,                  prospect_email_lc, NULL))          AS deals,
  SUM(IF(is_deal, cash_collected, 0))                                             AS cash,
  SUM(IF(is_deal, revenue_generated, 0))                                          AS revenue,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)))      AS setter_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS closer_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))) AS show_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS close_rate_shows,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))) AS close_rate_cq
FROM ${ENRICHED}
WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}
  AND closer_owner IS NOT NULL
GROUP BY 1
ORDER BY cash DESC`;

// Tab 3 — Setter Performance Overall (Monday §9.6). Same shape, by setter_owner.
export const SQL_SETTER_OVERALL = `SELECT
  setter_owner,
  COUNT(DISTINCT prospect_email_lc)                                              AS prospects,
  COUNT(DISTINCT IF(is_dispositioned,         prospect_email_lc, NULL))          AS prospects_dd,
  COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL))          AS setter_dq,
  COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL))          AS closer_dq,
  COUNT(DISTINCT IF(is_show_rate_eligible,    prospect_email_lc, NULL))          AS prospects_sq,
  COUNT(DISTINCT IF(is_show_up,               prospect_email_lc, NULL))          AS shows,
  COUNT(DISTINCT IF(is_close_rate_eligible,   prospect_email_lc, NULL))          AS qualified_shows,
  COUNT(DISTINCT IF(is_deal,                  prospect_email_lc, NULL))          AS deals,
  SUM(IF(is_deal, cash_collected, 0))                                             AS cash,
  SUM(IF(is_deal, revenue_generated, 0))                                          AS revenue,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)))      AS setter_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS closer_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))) AS show_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS close_rate_shows,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))) AS close_rate_cq
FROM ${ENRICHED}
WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}
  AND setter_owner IS NOT NULL
GROUP BY 1
ORDER BY cash DESC`;

// Tab 3 — Setter by Booking Mode (Monday §9.7). Joins to stg_ghl_form_submissions_flat
// for the median time-to-book derivation.
export const SQL_SETTER_BY_MODE = `WITH ghl_lead AS (
    SELECT
      LOWER(email)              AS prospect_email_lc,
      DATE(MIN(created_at))     AS lead_created_date
    FROM ${GHL_FORM_SUB}
    WHERE email IS NOT NULL
    GROUP BY 1
  )
  SELECT
    c.setter_owner,
    IF(c.is_setter_flow, 'Setter', IF(c.is_webinar_flow, 'Webinar', 'Other'))      AS mode,
    COUNT(DISTINCT c.prospect_email_lc)                                            AS prospects,
    COUNT(DISTINCT IF(c.is_dispositioned, c.prospect_email_lc, NULL))              AS prospects_dd,
    COUNT(DISTINCT IF(c.call_outcome='Setter DQ', c.prospect_email_lc, NULL))      AS setter_dq,
    COUNT(DISTINCT IF(c.call_outcome='Closer DQ', c.prospect_email_lc, NULL))      AS closer_dq,
    COUNT(DISTINCT IF(c.is_show_rate_eligible, c.prospect_email_lc, NULL))         AS prospects_sq,
    COUNT(DISTINCT IF(c.is_show_up, c.prospect_email_lc, NULL))                    AS shows,
    COUNT(DISTINCT IF(c.is_close_rate_eligible, c.prospect_email_lc, NULL))        AS qualified_shows,
    COUNT(DISTINCT IF(c.is_deal, c.prospect_email_lc, NULL))                       AS deals,
    SUM(IF(c.is_deal, c.cash_collected, 0))                                         AS cash,
    APPROX_QUANTILES(
      DATE_DIFF(DATE(c.calendly_created_ts, 'America/New_York'),
                l.lead_created_date, DAY), 2
    )[OFFSET(1)] AS median_time_to_book_days,
    SAFE_DIVIDE(COUNT(DISTINCT IF(c.call_outcome='Setter DQ', c.prospect_email_lc, NULL)),
                COUNT(DISTINCT IF(c.is_dispositioned, c.prospect_email_lc, NULL)))      AS setter_dq_rate,
    SAFE_DIVIDE(COUNT(DISTINCT IF(c.call_outcome='Closer DQ', c.prospect_email_lc, NULL)),
                COUNT(DISTINCT IF(c.is_show_up, c.prospect_email_lc, NULL)))            AS closer_dq_rate,
    SAFE_DIVIDE(COUNT(DISTINCT IF(c.is_show_up, c.prospect_email_lc, NULL)),
                COUNT(DISTINCT IF(c.is_show_rate_eligible, c.prospect_email_lc, NULL))) AS show_rate,
    SAFE_DIVIDE(COUNT(DISTINCT IF(c.is_close_rate_eligible AND c.is_deal, c.prospect_email_lc, NULL)),
                COUNT(DISTINCT IF(c.is_show_up, c.prospect_email_lc, NULL)))            AS close_rate_shows,
    SAFE_DIVIDE(COUNT(DISTINCT IF(c.is_close_rate_eligible AND c.is_deal, c.prospect_email_lc, NULL)),
                COUNT(DISTINCT IF(c.is_close_rate_eligible, c.prospect_email_lc, NULL))) AS close_rate_cq
  FROM ${ENRICHED} c
  LEFT JOIN ghl_lead l USING (prospect_email_lc)
  WHERE DATE(c.appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
    AND c.setter_owner IS NOT NULL
    AND c.prospect_email_lc NOT LIKE '%@nomoremondays.io%'
    AND c.prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')
  GROUP BY 1, 2
  ORDER BY setter_owner, mode`;

// Tab 3 — Booking Mode Split (Monday §9.8). 3 rows: Webinar / Setter / Other.
export const SQL_BOOKING_MODE = `SELECT
  CASE
    WHEN is_webinar_flow THEN 'Webinar Booked'
    WHEN is_setter_flow  THEN 'Setter Booked'
    ELSE 'Other'
  END                                                                            AS booking_mode,
  COUNT(DISTINCT prospect_email_lc)                                              AS prospects,
  COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL))                  AS prospects_dd,
  COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL))          AS setter_dq,
  COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL))          AS closer_dq,
  COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))             AS prospects_sq,
  COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL))                        AS shows,
  COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))            AS qualified_shows,
  COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL))                           AS deals,
  SUM(IF(is_deal, cash_collected, 0))                                             AS cash,
  SUM(IF(is_deal, revenue_generated, 0))                                          AS revenue,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)))      AS setter_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS closer_dq_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))) AS show_rate,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)))            AS close_rate_shows,
  SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
              COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))) AS close_rate_cq
FROM ${ENRICHED}
WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
  AND ${EMAIL_EXCLUSION}
GROUP BY 1
ORDER BY cash DESC`;

// ============================================================================
// SECTION 1 — PERSISTENT KPI STRIP (§2)
// ============================================================================

export type KpiStripData = {
  avgWebinarShowRate: number | null;     // §2.1 — target 24%
  pctTierOneLeads: number | null;         // §2.2 — placeholder, returns null today
  blendedCashRoas: number | null;         // §2.3 — target 4x
  cplBlended: number | null;              // §2.4 — placeholder, returns null today
  cashPerBookedCall: number | null;       // §2.5 — Sergio's DPC
};

/** §2.1 Avg Webinar Show Rate — weighted attend rate across the LAST 3 Sun/Wed
 * webinars anchored on the latest_webinar_date. Was a 7-day window which
 * excluded the just-happened webinar (Monday recap's prev-Sat window ends
 * one day before the new Sunday webinar). */
export async function fetchAvgWebinarShowRate(latestWebinarDate: string): Promise<number | null> {
  const [rows] = await bq().query({
    query: SQL_AVG_WEBINAR_SHOW_RATE,
    params: { latest: latestWebinarDate },
    types: { latest: "STRING" },
  });
  const v = (rows[0] as { avg_webinar_show_rate: number | null } | undefined)?.avg_webinar_show_rate;
  return v ?? null;
}

/** §2.2 % Tier 1 Leads — placeholder; returns null until the mart fields land.
 * Scoped to marketing week (Mon-Sun) since it's a webinar/lead-quality metric. */
export async function fetchPctTierOneLeads(mwStart: string, mwEnd: string): Promise<number | null> {
  try {
    const [rows] = await bq().query({
      query: SQL_PCT_TIER_ONE_LEADS,
      params: { start: mwStart, end: mwEnd },
      types: { start: "STRING", end: "STRING" },
    });
    const v = (rows[0] as { pct_tier_one_leads: number | null } | undefined)?.pct_tier_one_leads;
    return v ?? null;
  } catch {
    // Fields not yet in the mart — graceful N/A.
    return null;
  }
}

/** §2.3 Blended Cash ROAS — Fanbasis cash / total Meta spend */
export async function fetchBlendedCashRoas(prevSun: string, prevSat: string): Promise<number | null> {
  const [rows] = await bq().query({
    query: SQL_BLENDED_CASH_ROAS,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const v = (rows[0] as { blended_cash_roas: number | null } | undefined)?.blended_cash_roas;
  return v ?? null;
}

/** §2.4 CPL Blended — placeholder; denominator field undecided */
export async function fetchCplBlended(_prevSun: string, _prevSat: string): Promise<number | null> {
  // Open Item #2 in the spec — no agreed denominator yet. Return null until resolved.
  return null;
}

/** §2.5 Cash / Booked Call — Fanbasis cash / total booked calls */
export async function fetchCashPerBookedCall(prevSun: string, prevSat: string): Promise<number | null> {
  const [rows] = await bq().query({
    query: SQL_CASH_PER_BOOKED_CALL,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const v = (rows[0] as { cash_per_booked_call: number | null } | undefined)?.cash_per_booked_call;
  return v ?? null;
}

/** Wrapper that fires all 5 KPI queries in parallel.
 * Window conventions (Taziem 2026-05-18):
 *   - prevSun/prevSat   = sales week (Sun-Sat ET) → cash/ROAS/calls metrics
 *   - latestWebinarDate = anchor for "last 3 webinars" lookback
 *   - mwStart/mwEnd     = marketing week (Mon-Sun ET) → tier-one leads */
export async function fetchKpiStrip(
  prevSun: string, prevSat: string,
  latestWebinarDate: string,
  mwStart: string, mwEnd: string,
): Promise<KpiStripData> {
  const [avgWebinarShowRate, pctTierOneLeads, blendedCashRoas, cplBlended, cashPerBookedCall] =
    await Promise.all([
      fetchAvgWebinarShowRate(latestWebinarDate),
      fetchPctTierOneLeads(mwStart, mwEnd),
      fetchBlendedCashRoas(prevSun, prevSat),
      fetchCplBlended(prevSun, prevSat),
      fetchCashPerBookedCall(prevSun, prevSat),
    ]);
  return { avgWebinarShowRate, pctTierOneLeads, blendedCashRoas, cplBlended, cashPerBookedCall };
}

// ============================================================================
// SECTION 2 — TAB 1 SECTION A "Overall Company Performance" (§3)
// ============================================================================

export type SectionAData = {
  cashCollected: number | null;          // §3.1
  revenueTcv: number | null;             // §3.2
  roasCash: number | null;               // §3.3
  roasTcv: number | null;                // §3.4
  adSpendBlended: number | null;         // §3.5
  dealsClosed: number | null;            // §3.6
  aov: number | null;                    // §3.7
  acv: number | null;                    // §3.8
  pifRate: number | null;                // §3.9
  cashCollectionRate: number | null;     // §3.10
  // Cycle metrics — median AND average, both rendered (§3.11–3.12)
  medianBookToCloseOcc: number | null;   // §3.11
  avgBookToCloseOcc: number | null;
  nOcc: number;
  medianFirstCallToCloseFuc: number | null; // §3.12
  avgFirstCallToCloseFuc: number | null;
  nFuc: number;
};

/** §3.1–3.10 — All money + ratio cards in one round trip via mart_high_level_daily + Fanbasis. */
export async function fetchSectionAMoney(prevSun: string, prevSat: string): Promise<Omit<SectionAData, "medianBookToCloseOcc" | "avgBookToCloseOcc" | "nOcc" | "medianFirstCallToCloseFuc" | "avgFirstCallToCloseFuc" | "nFuc">> {
  // Two parallel queries: Fanbasis cash + mart_high_level_daily aggregates.
  const [cashRows, hlRows] = await Promise.all([
    bq().query({
      query: SQL_SECTION_A_CASH,
      params: { start: prevSun, end: prevSat },
      types: { start: "STRING", end: "STRING" },
    }),
    bq().query({
      query: SQL_SECTION_A_HL,
      params: { start: prevSun, end: prevSat },
      types: { start: "STRING", end: "STRING" },
    }),
  ]);
  const cash = Number((cashRows[0]?.[0] as { cash_money_in: number | null })?.cash_money_in ?? 0);
  const hl = (hlRows[0] as Array<{ tcv: number | null; ad_spend: number | null; deals: number | null; pif_deals: number | null }>)[0] ?? {};
  const tcv = Number(hl?.tcv ?? 0);
  const adSpend = Number(hl?.ad_spend ?? 0);
  const deals = Number(hl?.deals ?? 0);
  const pifDeals = Number(hl?.pif_deals ?? 0);
  return {
    cashCollected: cash,
    revenueTcv: tcv,
    roasCash: adSpend > 0 ? cash / adSpend : null,
    roasTcv: adSpend > 0 ? tcv / adSpend : null,
    adSpendBlended: adSpend,
    dealsClosed: deals,
    aov: deals > 0 ? cash / deals : null,
    acv: deals > 0 ? tcv / deals : null,
    pifRate: deals > 0 ? pifDeals / deals : null,
    cashCollectionRate: tcv > 0 ? cash / tcv : null,
  };
}

/** §3.11 OCC cycle — median + avg + count for Book→Close, filter close_type='OCC' */
export async function fetchOccCycle(prevSun: string, prevSat: string): Promise<{ median: number | null; avg: number | null; n: number }> {
  const [rows] = await bq().query({
    query: SQL_OCC_CYCLE,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows[0] as { median_book_to_close_occ: number | null; avg_book_to_close_occ: number | null; n_occ: number }) ?? {};
  return { median: r.median_book_to_close_occ ?? null, avg: r.avg_book_to_close_occ ?? null, n: Number(r.n_occ ?? 0) };
}

/** §3.12 FUC cycle — median + avg + count for 1st-Call→Close, filter close_type='FUC' */
export async function fetchFucCycle(prevSun: string, prevSat: string): Promise<{ median: number | null; avg: number | null; n: number }> {
  const [rows] = await bq().query({
    query: SQL_FUC_CYCLE,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows[0] as { median_first_call_to_close_fuc: number | null; avg_first_call_to_close_fuc: number | null; n_fuc: number }) ?? {};
  return { median: r.median_first_call_to_close_fuc ?? null, avg: r.avg_first_call_to_close_fuc ?? null, n: Number(r.n_fuc ?? 0) };
}

/** Section A wrapper — runs money + OCC + FUC in parallel. */
export async function fetchSectionA(prevSun: string, prevSat: string): Promise<SectionAData> {
  const [money, occ, fuc] = await Promise.all([
    fetchSectionAMoney(prevSun, prevSat),
    fetchOccCycle(prevSun, prevSat),
    fetchFucCycle(prevSun, prevSat),
  ]);
  return {
    ...money,
    medianBookToCloseOcc: occ.median,
    avgBookToCloseOcc: occ.avg,
    nOcc: occ.n,
    medianFirstCallToCloseFuc: fuc.median,
    avgFirstCallToCloseFuc: fuc.avg,
    nFuc: fuc.n,
  };
}

/** Tab 3 "Latest Sales Week" money — closer-attributed from int_calls_enriched.
 *  Distinct from fetchSectionAMoney (Fanbasis money-in). Same shape minus the
 *  cycle/ROAS/ad-spend fields, plus a `closerCashCollectionRate = cash / revenue`.
 *  All cards on Tab 3's Money grid pull from this. */
export type SectionATab3Data = {
  cashCollected: number | null;          // SUM(cash_collected) WHERE is_deal
  revenueTcv: number | null;             // SUM(revenue_generated) WHERE is_deal
  dealsClosed: number | null;            // distinct deal-prospects
  aov: number | null;                    // cash / deals (apples-to-apples)
  acv: number | null;                    // revenue / deals (apples-to-apples)
  pifRate: number | null;                // pif_deals / deals
  cashCollectionRate: number | null;     // cash / revenue
};

export async function fetchSectionATab3Closer(prevSun: string, prevSat: string): Promise<SectionATab3Data> {
  const [rows] = await bq().query({
    query: SQL_TAB3_MONEY_CLOSER,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows[0] as { deals: number | null; pif_deals: number | null; cash: number | null; revenue: number | null }) ?? {};
  const deals = Number(r?.deals ?? 0);
  const pif = Number(r?.pif_deals ?? 0);
  const cash = Number(r?.cash ?? 0);
  const revenue = Number(r?.revenue ?? 0);
  return {
    cashCollected: cash,
    revenueTcv: revenue,
    dealsClosed: deals,
    aov: deals > 0 ? cash / deals : null,
    acv: deals > 0 ? revenue / deals : null,
    pifRate: deals > 0 ? pif / deals : null,
    cashCollectionRate: revenue > 0 ? cash / revenue : null,
  };
}

// ============================================================================
// SECTION 3 — TAB 1 SECTION B "Marketing Efficiency" (§4)
// ============================================================================

export type SectionBData = {
  totalCallsBooked: number | null;       // §4.1
  totalCallsBookedActive: number | null; // §4.1 sub-line
  costPerBookedCall: number | null;      // §4.2
  cashPerBookedCall: number | null;      // §4.3 = §2.5
  avgWebinarShowRate: number | null;     // §4.4 = §2.1
  cplBlended: number | null;             // §4.5 = §2.4
};

/** §4.1, §4.2 — total calls booked + cost per booked. KPI strip values reused for §4.3-4.5. */
export async function fetchSectionB(prevSun: string, prevSat: string, kpiStrip: KpiStripData): Promise<SectionBData> {
  const [rows] = await bq().query({
    query: SQL_SECTION_B,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows[0] as { total_calls_booked: number | null; total_calls_booked_active: number | null; ad_spend: number | null })
    ?? { total_calls_booked: 0, total_calls_booked_active: 0, ad_spend: 0 };
  const calls = Number(r.total_calls_booked ?? 0);
  const adSpend = Number(r.ad_spend ?? 0);
  return {
    totalCallsBooked: calls,
    totalCallsBookedActive: Number(r.total_calls_booked_active ?? 0),
    costPerBookedCall: calls > 0 ? adSpend / calls : null,
    cashPerBookedCall: kpiStrip.cashPerBookedCall,
    avgWebinarShowRate: kpiStrip.avgWebinarShowRate,
    cplBlended: kpiStrip.cplBlended,
  };
}

// ============================================================================
// SECTION 4 — TAB 1 SECTION C "Sales Efficiency" (§5)
// ============================================================================

export type SectionCData = {
  // Funnel counts (§5.1 / Monday §6.1)
  prospects: number;
  prospectsDd: number;       // Pros (D'd)
  setterDq: number;
  closerDq: number;
  prospectsSq: number;       // Pros (SQ)
  showsSq: number;           // Shows (renamed display label on Monday)
  showsCq: number;           // Qualified Shows (renamed display label on Monday)
  deals: number;
  cashIntCalls: number;      // Cash from int_calls_enriched (NOT Fanbasis; used for $/X ratios only)
  revenue: number;
  // Rates — derived
  showRate: number | null;            // §5.2 / Monday §6.2
  closeRate: number | null;           // Close Rate (CQ) = Deals / Qualified Shows — §5.3 / Monday §6.4
  closeRateShows: number | null;      // NEW (Monday §6.3) — Deals / Shows (broader denominator)
  setterDqRate: number | null;        // §5.4 / Monday §6.5
  closerDqRate: number | null;        // §5.5 / Monday §6.6 — Closer DQ / Shows (NOT / Qualified Shows)
  // Efficiency — derived
  ddToCq: number | null;              // Qualified Shows / Pros (D'd) — Monday §6.7
  ddToClose: number | null;           // Deals / Pros (D'd) — Monday §6.8
  dollarsCcPerPdd: number | null;     // Cash / Pros (D'd) — Monday §6.9
  dollarsCcPerShowsSq: number | null; // Cash / Shows — Monday §6.10
  dollarsTcvPerPdd: number | null;    // TCV / Pros (D'd) — Monday §6.11
  dollarsTcvPerShowsSq: number | null; // TCV / Shows — Monday §6.12
};

export async function fetchSectionC(prevSun: string, prevSat: string): Promise<SectionCData> {
  const [rows] = await bq().query({
    query: SQL_SECTION_C,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows[0] as Record<string, number | null>) ?? {};
  const prospects = Number(r.prospects ?? 0);
  const prospectsDd = Number(r.prospects_dd ?? 0);
  const setterDq = Number(r.setter_dq ?? 0);
  const closerDq = Number(r.closer_dq ?? 0);
  const prospectsSq = Number(r.prospects_sq ?? 0);
  const showsSq = Number(r.shows_sq ?? 0);
  const showsCq = Number(r.shows_cq ?? 0);
  const deals = Number(r.deals ?? 0);
  const cashIntCalls = Number(r.cash_int_calls ?? 0);
  const revenue = Number(r.revenue ?? 0);

  return {
    prospects, prospectsDd, setterDq, closerDq, prospectsSq, showsSq, showsCq, deals, cashIntCalls, revenue,
    // Show Rate = Shows / Pros (SQ)
    showRate: prospectsSq > 0 ? showsSq / prospectsSq : null,
    // Close Rate (CQ) = Deals / Qualified Shows
    closeRate: showsCq > 0 ? deals / showsCq : null,
    // Close Rate (Shows) = Deals / Shows (broader denominator) — Monday §6.3
    closeRateShows: showsSq > 0 ? deals / showsSq : null,
    // Setter DQ Rate = Setter DQ / Pros (D'd)
    setterDqRate: prospectsDd > 0 ? setterDq / prospectsDd : null,
    // Closer DQ Rate = Closer DQ / Shows (broader denominator per Monday §6.6)
    closerDqRate: showsSq > 0 ? closerDq / showsSq : null,
    // D'd → Qualified Shows
    ddToCq: prospectsDd > 0 ? showsCq / prospectsDd : null,
    // D'd → Close
    ddToClose: prospectsDd > 0 ? deals / prospectsDd : null,
    // Dollars (CC) / Pros (D'd)
    dollarsCcPerPdd: prospectsDd > 0 ? cashIntCalls / prospectsDd : null,
    // Dollars (CC) / Shows
    dollarsCcPerShowsSq: showsSq > 0 ? cashIntCalls / showsSq : null,
    // Dollars (TCV) / Pros (D'd)
    dollarsTcvPerPdd: prospectsDd > 0 ? revenue / prospectsDd : null,
    // Dollars (TCV) / Shows
    dollarsTcvPerShowsSq: showsSq > 0 ? revenue / showsSq : null,
  };
}

// ============================================================================
// SECTION 5 — TAB 2 LATEST WEBINAR — 3-Webinar Comparison (§7)
// ============================================================================

export type WebinarComparisonRowV2 = {
  webinarDate: string;
  webinarDay: string;
  // Spend split
  totalWebinarAdSpend: number; webinarRegAdSpend: number; webinarHammerThemAdSpend: number;
  // LP funnel
  lpPageViews: number; lpOptIns: number; lpOptInRate: number | null; lpFormSubmissions: number;
  // Registrants
  totalRegistrants: number; metaRegistrants: number; tiktokRegistrants: number;
  manychatRegistrants: number; setterRegistrants: number; otherOrganicRegistrants: number;
  // Attendance
  uniqueAttendees: number; pitchedAttendees: number; regToAttendRate: number | null; attendToPitchedRate: number | null;
  // Cost efficiency
  paidCpr: number | null; blendedCpa: number | null; blendedCpbc: number | null; blendedCpbcActive: number | null;
  blendedCostPerShow: number | null; blendedCostPerQualifiedShow: number | null;
  // Meta funnel (registration campaigns only)
  metaImpressions: number; metaLinkClicks: number; metaCtr: number | null; metaCvr: number | null; metaCpl: number | null;
  metaReportedConversions: number;
  // Bookings
  callsBooked: number; callsBookedActive: number;
  // Sales downstream
  shows: number; qualifiedShows: number; webinarDeposits: number; dealsClosed: number;
  cashCollected: number; depositCollected: number; revenueGenerated: number;
  cashCollectedPerAttendee: number | null; contractValuePerAttendee: number | null;
  // ROAS / CAC
  roasCash: number | null; roasCashRunning: number | null; roasRevenue: number | null; cac: number | null;
  // Reactivation
  reactivationPoolSize: number; reactivationsAttended: number; reactivationsBooked: number;
  isReactivationDataAvailable: boolean;
};

/**
 * §7 — 3-webinar comparison.
 *
 * Monday: dates = [latest_sun, latest_sun − 4 (Wed), latest_sun − 7 (Sun)]
 * Thursday: dates = [latest_wed, latest_wed − 3 (Sun), latest_wed − 7 (Wed)]
 *
 * Caller computes the dates per the report type and passes them in here.
 */
export async function fetchWebinarComparisonV2(dates: string[]): Promise<WebinarComparisonRowV2[]> {
  if (dates.length === 0) return [];
  // Build a parameterized IN clause. BigQuery supports array params.
  const [rows] = await bq().query({
    query: SQL_WEBINAR_COMPARISON,
    params: { dates: dates.map((d) => d) },
    types: { dates: ["STRING"] },
  });
  return (rows as Record<string, unknown>[]).map((r) => mapWebinarComparisonRow(r));
}

function num(v: unknown): number { return Number(v ?? 0); }
function nNull(v: unknown): number | null { return v == null ? null : Number(v); }
function dateStr(v: unknown): string { return typeof v === "string" ? v : (v as { value?: string })?.value ?? ""; }

function mapWebinarComparisonRow(r: Record<string, unknown>): WebinarComparisonRowV2 {
  return {
    webinarDate: dateStr(r.webinar_date),
    webinarDay: String(r.webinar_day ?? ""),
    totalWebinarAdSpend: num(r.total_webinar_ad_spend),
    webinarRegAdSpend: num(r.webinar_reg_ad_spend),
    webinarHammerThemAdSpend: num(r.webinar_hammer_them_ad_spend),
    lpPageViews: num(r.lp_page_views),
    lpOptIns: num(r.lp_opt_ins),
    lpOptInRate: nNull(r.lp_opt_in_rate),
    lpFormSubmissions: num(r.lp_form_submissions),
    totalRegistrants: num(r.total_registrants),
    metaRegistrants: num(r.meta_registrants),
    tiktokRegistrants: num(r.tiktok_registrants),
    manychatRegistrants: num(r.manychat_registrants),
    setterRegistrants: num(r.setter_registrants),
    otherOrganicRegistrants: num(r.other_organic_registrants),
    uniqueAttendees: num(r.unique_attendees),
    pitchedAttendees: num(r.pitched_attendees),
    regToAttendRate: nNull(r.reg_to_attend_rate),
    attendToPitchedRate: nNull(r.attend_to_pitched_rate),
    paidCpr: nNull(r.paid_cpr),
    blendedCpa: nNull(r.blended_cpa),
    blendedCpbc: nNull(r.blended_cpbc),
    blendedCpbcActive: nNull(r.blended_cpbc_active),
    blendedCostPerShow: nNull(r.blended_cost_per_show),
    blendedCostPerQualifiedShow: nNull(r.blended_cost_per_qualified_show),
    metaImpressions: num(r.meta_impressions),
    metaLinkClicks: num(r.meta_link_clicks),
    metaCtr: nNull(r.meta_ctr),
    metaCvr: nNull(r.meta_cvr),
    metaCpl: nNull(r.meta_cpl),
    metaReportedConversions: num(r.meta_reported_conversions),
    callsBooked: num(r.calls_booked),
    callsBookedActive: num(r.calls_booked_active),
    shows: num(r.shows),
    qualifiedShows: num(r.qualified_shows),
    webinarDeposits: num(r.webinar_deposits),
    dealsClosed: num(r.deals_closed),
    cashCollected: num(r.cash_collected),
    depositCollected: num(r.deposit_collected),
    revenueGenerated: num(r.revenue_generated),
    cashCollectedPerAttendee: nNull(r.cash_collected_per_attendee),
    contractValuePerAttendee: nNull(r.contract_value_per_attendee),
    roasCash: nNull(r.roas_cash),
    roasCashRunning: nNull(r.roas_cash_running),
    roasRevenue: nNull(r.roas_revenue),
    cac: nNull(r.cac),
    reactivationPoolSize: num(r.reactivation_pool_size),
    reactivationsAttended: num(r.reactivations_attended),
    reactivationsBooked: num(r.reactivations_booked),
    isReactivationDataAvailable: Boolean(r.is_reactivation_data_available),
  };
}

// ============================================================================
// SECTION 6 — TAB 2 META CAMPAIGNS (§9)
// ============================================================================

export type MetaCampaignRow = {
  campaignName: string;
  campaignCategory: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  frequencyWindow: number | null;       // SUM(impressions) / MAX(reach)
  conversions: number;
  cpl: number | null;
  linkCtr: number | null;
  linkCvr: number | null;
};

/** §9 — per-campaign Meta data with Frequency. Promo window is caller-supplied. */
export async function fetchMetaCampaigns(promoStart: string, promoEnd: string): Promise<MetaCampaignRow[]> {
  const [rows] = await bq().query({
    query: SQL_META_CAMPAIGNS,
    params: { start: promoStart, end: promoEnd },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    campaignName: String(r.campaign_name ?? ""),
    campaignCategory: String(r.campaign_category ?? ""),
    spend: num(r.spend),
    impressions: num(r.impressions),
    linkClicks: num(r.link_clicks),
    frequencyWindow: nNull(r.frequency_window),
    conversions: num(r.conversions),
    cpl: nNull(r.cpl),
    linkCtr: nNull(r.link_ctr),
    linkCvr: nNull(r.link_cvr),
  }));
}

// ============================================================================
// SECTION 7 — TAB 3 LAST WEEK'S SALES (Monday only) — §11
// ============================================================================

export type CloserOverallRowV2 = {
  closerOwner: string;
  prospects: number; prospectsDd: number; setterDq: number; closerDq: number;
  prospectsSq: number; showsSq: number; showsCq: number; deals: number;
  cash: number; showRate: number | null; closeRate: number | null;
};

/** §11.3 Closer Performance Overall (appt_date_time basis). */
export async function fetchCloserOverallV2(prevSun: string, prevSat: string): Promise<CloserOverallRowV2[]> {
  const [rows] = await bq().query({
    query: `SELECT
        closer_owner,
        COUNT(DISTINCT prospect_email_lc)                                       AS prospects,
        COUNT(DISTINCT IF(is_dispositioned,        prospect_email_lc, NULL))    AS prospects_dd,
        COUNT(DISTINCT IF(call_outcome='Setter DQ',prospect_email_lc, NULL))    AS setter_dq,
        COUNT(DISTINCT IF(call_outcome='Closer DQ',prospect_email_lc, NULL))    AS closer_dq,
        COUNT(DISTINCT IF(is_show_rate_eligible,   prospect_email_lc, NULL))    AS prospects_sq,
        COUNT(DISTINCT IF(is_show_up,              prospect_email_lc, NULL))    AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible,  prospect_email_lc, NULL))    AS shows_cq,
        COUNT(DISTINCT IF(is_deal,                 prospect_email_lc, NULL))    AS deals,
        SUM(IF(is_deal, cash_collected, 0))                                      AS cash,
        SAFE_DIVIDE(COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
                    COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))) AS show_rate,
        SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
                    COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))) AS close_rate
      FROM ${ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND ${EMAIL_EXCLUSION}
        AND closer_owner IS NOT NULL
      GROUP BY 1
      ORDER BY cash DESC`,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    closerOwner: String(r.closer_owner ?? ""),
    prospects: num(r.prospects),
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    closerDq: num(r.closer_dq),
    prospectsSq: num(r.prospects_sq),
    showsSq: num(r.shows_sq),
    showsCq: num(r.shows_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    showRate: nNull(r.show_rate),
    closeRate: nNull(r.close_rate),
  }));
}

export type BookingModeRowV2 = {
  bookingMode: "Webinar Booked" | "Setter Booked" | "Other";
  prospects: number; prospectsSq: number; showsSq: number; showsCq: number; deals: number;
  cash: number; showRate: number | null; closeRate: number | null;
};

/** §11.4 Booking Mode Split. */
export async function fetchBookingModeV2(prevSun: string, prevSat: string): Promise<BookingModeRowV2[]> {
  const [rows] = await bq().query({
    query: `SELECT
        CASE
          WHEN is_webinar_flow THEN 'Webinar Booked'
          WHEN is_setter_flow  THEN 'Setter Booked'
          ELSE 'Other'
        END                                                                      AS booking_mode,
        COUNT(DISTINCT prospect_email_lc)                                        AS prospects,
        COUNT(DISTINCT IF(is_show_rate_eligible,  prospect_email_lc, NULL))      AS prospects_sq,
        COUNT(DISTINCT IF(is_show_up,             prospect_email_lc, NULL))      AS shows_sq,
        COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))      AS shows_cq,
        COUNT(DISTINCT IF(is_deal,                prospect_email_lc, NULL))      AS deals,
        SUM(IF(is_deal, cash_collected, 0))                                       AS cash,
        SAFE_DIVIDE(COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
                    COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))) AS show_rate,
        SAFE_DIVIDE(COUNT(DISTINCT IF(is_close_rate_eligible AND is_deal, prospect_email_lc, NULL)),
                    COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))) AS close_rate
      FROM ${ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND ${EMAIL_EXCLUSION}
      GROUP BY 1
      ORDER BY cash DESC`,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    bookingMode: String(r.booking_mode ?? "Other") as BookingModeRowV2["bookingMode"],
    prospects: num(r.prospects),
    prospectsSq: num(r.prospects_sq),
    showsSq: num(r.shows_sq),
    showsCq: num(r.shows_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    showRate: nNull(r.show_rate),
    closeRate: nNull(r.close_rate),
  }));
}

export type SetterPerformanceRowV2 = {
  setterOwner: string;
  mode: "Setter" | "Webinar";
  prospectsDd: number; setterDq: number; setterDqRate: number | null;
  prospectsSq: number; showsSq: number; showRate: number | null;
  medianTimeToBookDays: number | null;
  deals: number; cash: number;
};

/** §11.5 Setter Performance with time-to-book. */
export async function fetchSetterPerformanceV2(prevSun: string, prevSat: string): Promise<SetterPerformanceRowV2[]> {
  const [rows] = await bq().query({
    query: `WITH ghl_lead AS (
        SELECT
          LOWER(email)              AS prospect_email_lc,
          DATE(MIN(created_at))     AS lead_created_date
        FROM ${GHL_FORM_SUB}
        WHERE email IS NOT NULL
        GROUP BY 1
      ),
      per_setter_mode AS (
        SELECT
          c.setter_owner,
          IF(c.is_setter_flow, 'Setter', 'Webinar')                                  AS mode,
          COUNT(DISTINCT IF(c.is_dispositioned,            c.prospect_email_lc, NULL)) AS prospects_dd,
          COUNT(DISTINCT IF(c.call_outcome='Setter DQ',    c.prospect_email_lc, NULL)) AS setter_dq,
          COUNT(DISTINCT IF(c.is_show_rate_eligible,       c.prospect_email_lc, NULL)) AS prospects_sq,
          COUNT(DISTINCT IF(c.is_show_up,                  c.prospect_email_lc, NULL)) AS shows_sq,
          COUNT(DISTINCT IF(c.is_deal,                     c.prospect_email_lc, NULL)) AS deals,
          SUM(IF(c.is_deal, c.cash_collected, 0))                                       AS cash,
          APPROX_QUANTILES(
            DATE_DIFF(DATE(c.calendly_created_ts, 'America/New_York'),
                      l.lead_created_date, DAY), 2
          )[OFFSET(1)] AS median_time_to_book_days
        FROM ${ENRICHED} c
        LEFT JOIN ghl_lead l USING (prospect_email_lc)
        WHERE DATE(c.appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
          AND c.setter_owner IS NOT NULL
          AND c.prospect_email_lc NOT LIKE '%@nomoremondays.io%'
          AND c.prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')
        GROUP BY 1, 2
      )
      SELECT
        setter_owner, mode,
        prospects_dd, setter_dq,
        SAFE_DIVIDE(setter_dq, prospects_dd) AS setter_dq_rate,
        prospects_sq, shows_sq,
        SAFE_DIVIDE(shows_sq, prospects_sq)  AS show_rate,
        median_time_to_book_days,
        deals, cash
      FROM per_setter_mode
      ORDER BY setter_owner, mode`,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    setterOwner: String(r.setter_owner ?? ""),
    mode: String(r.mode ?? "Setter") as SetterPerformanceRowV2["mode"],
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    setterDqRate: nNull(r.setter_dq_rate),
    prospectsSq: num(r.prospects_sq),
    showsSq: num(r.shows_sq),
    showRate: nNull(r.show_rate),
    medianTimeToBookDays: nNull(r.median_time_to_book_days),
    deals: num(r.deals),
    cash: num(r.cash),
  }));
}

// ============================================================================
// SECTION 8 — DATE HELPERS for Monday vs Thursday comparison IN-list
// ============================================================================

/** Add days to a YYYY-MM-DD date string. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the 3-webinar comparison dates for the new spec.
 * - Monday (latest Sun): [latest, latest−4 (Wed), latest−7 (Sun)]
 * - Thursday (latest Wed): [latest, latest−3 (Sun), latest−7 (Wed)]
 */
export function comparisonDatesForMode(latest: string, mode: "weekly_recap" | "midweek_check"): string[] {
  if (mode === "weekly_recap") {
    return [latest, addDays(latest, -4), addDays(latest, -7)];
  }
  return [latest, addDays(latest, -3), addDays(latest, -7)];
}

/**
 * Promo-window dates for the Meta campaigns table per §9 of the spec.
 * - Sunday webinar: Thu→Sun (4 days ending on latest_sun)
 * - Wednesday webinar: Sun→Wed (4 days ending on latest_wed)
 */
export function metaPromoWindow(latest: string, mode: "weekly_recap" | "midweek_check"): { start: string; end: string } {
  return mode === "weekly_recap"
    ? { start: addDays(latest, -3), end: latest }   // Thu→Sun
    : { start: addDays(latest, -3), end: latest };  // Sun→Wed (also 4 days)
}

// ============================================================================
// SECTION 9 — MONDAY TAB 3: Last Week's Sales (per monday spec §9)
// ============================================================================

/**
 * Extended Closer Performance — 15-col output including all rate columns.
 * Per Monday §9.5. Same SQL as fetchCloserOverallV2 but with all rates.
 */
export type CloserOverallExtended = {
  closerOwner: string;
  prospects: number;
  prospectsDd: number;
  setterDq: number;
  setterDqRate: number | null;
  closerDq: number;
  closerDqRate: number | null;
  prospectsSq: number;
  shows: number;             // renamed from showsSq
  showRate: number | null;
  qualifiedShows: number;     // renamed from showsCq
  closeRateShows: number | null;
  closeRateCq: number | null;
  deals: number;
  cash: number;
  revenue: number;            // SUM(revenue_generated) WHERE is_deal — full TCV (differs from cash on payment plans)
};

export async function fetchCloserOverallExtended(prevSun: string, prevSat: string): Promise<CloserOverallExtended[]> {
  try {
  const [rows] = await bq().query({
    query: SQL_CLOSER_OVERALL,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    closerOwner: String(r.closer_owner ?? ""),
    prospects: num(r.prospects),
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    setterDqRate: nNull(r.setter_dq_rate),
    closerDq: num(r.closer_dq),
    closerDqRate: nNull(r.closer_dq_rate),
    prospectsSq: num(r.prospects_sq),
    shows: num(r.shows),
    showRate: nNull(r.show_rate),
    qualifiedShows: num(r.qualified_shows),
    closeRateShows: nNull(r.close_rate_shows),
    closeRateCq: nNull(r.close_rate_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    revenue: num(r.revenue),
  }));
  } catch (err) {
    console.error("[weekly-report-bq-v2] fetchCloserOverallExtended failed:", err);
    return [];
  }
}

/**
 * Setter Performance — Overall (NEW per Monday §9.6). Same 15-col shape as
 * Closer Overall but grouped by setter_owner.
 */
export type SetterOverallRow = CloserOverallExtended & { setterOwner: string };

export async function fetchSetterOverall(prevSun: string, prevSat: string): Promise<SetterOverallRow[]> {
  try {
  const [rows] = await bq().query({
    query: SQL_SETTER_OVERALL,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    setterOwner: String(r.setter_owner ?? ""),
    closerOwner: String(r.setter_owner ?? ""), // dummy to satisfy type extension
    prospects: num(r.prospects),
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    setterDqRate: nNull(r.setter_dq_rate),
    closerDq: num(r.closer_dq),
    closerDqRate: nNull(r.closer_dq_rate),
    prospectsSq: num(r.prospects_sq),
    shows: num(r.shows),
    showRate: nNull(r.show_rate),
    qualifiedShows: num(r.qualified_shows),
    closeRateShows: nNull(r.close_rate_shows),
    closeRateCq: nNull(r.close_rate_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    revenue: num(r.revenue),
  }));
  } catch (err) {
    console.error("[weekly-report-bq-v2] fetchSetterOverall failed:", err);
    return [];
  }
}

/**
 * Setter Performance — by Booking Mode (per Monday §9.7). Adds Mode column,
 * median time-to-book days (joined to GHL lead-created date), and combined
 * bonus status. Each setter has TWO rows (Setter + Webinar) plus a combined
 * `.div-row` summary line.
 */
export type SetterByModeRow = {
  setterOwner: string;
  mode: "Setter" | "Webinar" | "Other";
  prospects: number;
  prospectsDd: number;
  setterDq: number;
  setterDqRate: number | null;
  closerDq: number;
  closerDqRate: number | null;
  prospectsSq: number;
  shows: number;
  showRate: number | null;
  qualifiedShows: number;
  closeRateShows: number | null;
  closeRateCq: number | null;
  deals: number;
  cash: number;
  revenue: number;
  medianTimeToBookDays: number | null;
};

export async function fetchSetterByMode(prevSun: string, prevSat: string): Promise<SetterByModeRow[]> {
  // Note: spec §9.7 joins to raw_ghl.contacts but that's outside dbt_tuddin.
  // We use stg_ghl_form_submissions_flat (already in dbt_tuddin) which
  // carries `email` + `created_at` (raw_ghl.contacts has no analogue here).
  try {
  const [rows] = await bq().query({
    query: SQL_SETTER_BY_MODE,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    setterOwner: String(r.setter_owner ?? ""),
    mode: String(r.mode ?? "Other") as SetterByModeRow["mode"],
    prospects: num(r.prospects),
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    setterDqRate: nNull(r.setter_dq_rate),
    closerDq: num(r.closer_dq),
    closerDqRate: nNull(r.closer_dq_rate),
    prospectsSq: num(r.prospects_sq),
    shows: num(r.shows),
    showRate: nNull(r.show_rate),
    qualifiedShows: num(r.qualified_shows),
    closeRateShows: nNull(r.close_rate_shows),
    closeRateCq: nNull(r.close_rate_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    revenue: num(r.revenue),
    medianTimeToBookDays: nNull(r.median_time_to_book_days),
  }));
  } catch (err) {
    console.error("[weekly-report-bq-v2] fetchSetterByMode failed:", err);
    return [];
  }
}

/**
 * Booking Mode Split — 15-col output per Monday §9.8 (extended over §11.4).
 * 3 rows: Webinar Booked / Setter Booked / Other.
 */
export type BookingModeExtended = CloserOverallExtended & { bookingMode: "Webinar Booked" | "Setter Booked" | "Other" };

export async function fetchBookingModeExtended(prevSun: string, prevSat: string): Promise<BookingModeExtended[]> {
  try {
  const [rows] = await bq().query({
    query: SQL_BOOKING_MODE,
    params: { start: prevSun, end: prevSat },
    types: { start: "STRING", end: "STRING" },
  });
  return (rows as Record<string, unknown>[]).map((r) => ({
    bookingMode: String(r.booking_mode ?? "Other") as BookingModeExtended["bookingMode"],
    closerOwner: String(r.booking_mode ?? ""),
    prospects: num(r.prospects),
    prospectsDd: num(r.prospects_dd),
    setterDq: num(r.setter_dq),
    setterDqRate: nNull(r.setter_dq_rate),
    closerDq: num(r.closer_dq),
    closerDqRate: nNull(r.closer_dq_rate),
    prospectsSq: num(r.prospects_sq),
    shows: num(r.shows),
    showRate: nNull(r.show_rate),
    qualifiedShows: num(r.qualified_shows),
    closeRateShows: nNull(r.close_rate_shows),
    closeRateCq: nNull(r.close_rate_cq),
    deals: num(r.deals),
    cash: num(r.cash),
    revenue: num(r.revenue),
  }));
  } catch (err) {
    console.error("[weekly-report-bq-v2] fetchBookingModeExtended failed:", err);
    return [];
  }
}

// Note: Tab 3 money cards reuse `fetchSectionA` directly — same data,
// different rendering. No new fetcher needed.
