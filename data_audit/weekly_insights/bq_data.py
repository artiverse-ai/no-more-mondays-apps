"""
Pulls the full set of dashboard tables for a single weekly-report snapshot.

Mirrors lib/weekly-report-bq.ts query-for-query so the LLM sees exactly what
the human analyst sees in the dashboard. Returns a dict structured for
direct JSON dumping into the prompt.
"""

from __future__ import annotations

import datetime as dt
import os
from typing import Any

from google.cloud import bigquery

# All NMM dashboards point at the same project/dataset.
PROJECT = os.environ.get("BQ_PROJECT", "no-more-mondays-analytics")
DATASET = os.environ.get("BQ_DATASET", "nmm_calendar")
MART_DATASET = os.environ.get("BQ_MART_DATASET", "dbt_tuddin")

MART = f"`{PROJECT}.{MART_DATASET}.mart_webinar_events`"
ENRICHED = f"`{PROJECT}.{MART_DATASET}.int_calls_enriched`"
MART_HL_DAILY = f"`{PROJECT}.{MART_DATASET}.mart_high_level_daily`"
FANBASIS = f"`{PROJECT}.{MART_DATASET}.stg_fanbasis_sales`"
FORECAST = f"`{PROJECT}.{DATASET}.forecast_targets`"
SNAPSHOTS = f"`{PROJECT}.{DATASET}.weekly_report_snapshots`"
INSIGHTS = f"`{PROJECT}.{DATASET}.weekly_report_insights`"
CLOSERS = f"`{PROJECT}.{DATASET}.closers`"

# Email exclusion mirrors lib/weekly-report-bq-v2.ts so closer-attributed
# numbers in the payload match what the dashboard shows.
EMAIL_EXCLUSION = (
    "prospect_email_lc NOT LIKE '%@nomoremondays.io%' "
    "AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')"
)


def _client() -> bigquery.Client:
    return bigquery.Client(project=PROJECT)


def _shift_days(d: str, days: int) -> str:
    return (dt.date.fromisoformat(d) + dt.timedelta(days=days)).isoformat()


def fetch_snapshot(slug: str) -> dict[str, Any] | None:
    """Returns the snapshot row that the cron has claimed (or None)."""
    sql = f"""
      SELECT slug, FORMAT_DATE('%F', run_on) AS run_on,
             FORMAT_DATE('%F', week_start) AS week_start,
             FORMAT_DATE('%F', week_end)   AS week_end,
             report_type, week_label, badge, latest_webinar,
             context_tag, context_title, context_body
      FROM {SNAPSHOTS}
      WHERE slug = @slug AND deleted_at IS NULL
      LIMIT 1
    """
    params = [bigquery.ScalarQueryParameter("slug", "STRING", slug)]
    job = _client().query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params))
    rows = list(job.result())
    if not rows:
        return None
    return dict(rows[0].items())


def reset_stuck_generating(stale_minutes: int = 10) -> int:
    """Self-heal — if a row has been stuck in 'generating' for >stale_minutes
    (typical signal of a VM crash mid-run or a Python exception that didn't
    reach mark_failed), reset it to 'pending' so the next poll picks it up.

    Called at the top of claim_pending so every cron tick self-heals.
    Returns the number of rows reset.
    """
    cli = _client()
    sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'pending',
          insights_generation_error = CONCAT('auto-reset after stuck >',
            CAST(@minutes AS STRING), 'min in generating'),
          updated_at = CURRENT_TIMESTAMP()
      WHERE insights_generation_status = 'generating'
        AND deleted_at IS NULL
        AND updated_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @minutes MINUTE)
    """
    job = cli.query(
        sql,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("minutes", "INT64", stale_minutes),
        ]),
    )
    job.result()
    return int(job.num_dml_affected_rows or 0)


def claim_pending() -> dict[str, Any] | None:
    """
    Atomically pick one 'pending' snapshot, flip it to 'generating', and
    return it. Returns None if the queue is empty.

    Calls reset_stuck_generating() first so rows abandoned in 'generating'
    (e.g., from a VM crash or hard-killed Claude subprocess) get rescued
    automatically.
    """
    reset_stuck_generating()
    cli = _client()
    pick_sql = f"""
      SELECT slug FROM {SNAPSHOTS}
      WHERE insights_generation_status = 'pending' AND deleted_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    """
    rows = list(cli.query(pick_sql).result())
    if not rows:
        return None
    slug = rows[0]["slug"]

    # Optimistic claim: only flip to 'generating' if still 'pending'.
    claim_sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'generating',
          insights_generation_error = NULL,
          updated_at = CURRENT_TIMESTAMP()
      WHERE slug = @slug
        AND insights_generation_status = 'pending'
        AND deleted_at IS NULL
    """
    params = [bigquery.ScalarQueryParameter("slug", "STRING", slug)]
    job = cli.query(claim_sql, job_config=bigquery.QueryJobConfig(query_parameters=params))
    job.result()
    if job.num_dml_affected_rows == 0:
        # Another worker beat us to it — return None so the loop retries.
        return None

    return fetch_snapshot(slug)


def verify_active_for_write(slug: str, expected_status: str = "generating") -> bool:
    """Re-fetch the snapshot row and confirm it's still the same one we
    claimed at the start of the run. Returns False if the row has been
    soft-deleted or had its status changed by someone else (e.g., the
    admin clicked Delete in Vercel while Claude was responding).

    Called immediately before any DML writes so a long-running Claude call
    can't pollute a snapshot the user already moved on from.
    """
    cli = _client()
    sql = f"""
      SELECT insights_generation_status AS status
      FROM {SNAPSHOTS}
      WHERE slug = @slug AND deleted_at IS NULL
      LIMIT 1
    """
    rows = list(cli.query(
        sql,
        job_config=bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("slug", "STRING", slug),
        ]),
    ).result())
    if not rows:
        return False  # row was soft-deleted while we were generating
    return rows[0]["status"] == expected_status


def mark_succeeded(slug: str) -> None:
    """Marks ONLY the active row (deleted_at IS NULL) as succeeded.

    Without the deleted_at filter, this UPDATE would touch every historical
    row with the same slug — including a freshly-created 'pending' row from
    a delete-then-recreate workflow. That blanket-update was incorrectly
    flipping new pending rows to 'succeeded', hiding them from the polling
    wrapper and breaking auto-generation on recreate.
    """
    cli = _client()
    sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'succeeded',
          insights_generation_error = NULL,
          insights_generated_at = CURRENT_TIMESTAMP(),
          updated_at = CURRENT_TIMESTAMP()
      WHERE slug = @slug
        AND deleted_at IS NULL
        AND insights_generation_status = 'generating'
    """
    cli.query(sql, job_config=bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("slug", "STRING", slug)]
    )).result()


def update_snapshot_narratives(
    slug: str,
    context_banner: dict[str, str] | None,
    tab2_narrative: dict[str, str] | None,
) -> None:
    """Persists Claude's AI-generated tab banners onto the snapshot row.
    Passing None for a banner leaves the existing values untouched so a
    human-edited banner isn't overwritten by an empty AI response.
    """
    set_clauses: list[str] = ["updated_at = CURRENT_TIMESTAMP()"]
    params: list[bigquery.ScalarQueryParameter] = [
        bigquery.ScalarQueryParameter("slug", "STRING", slug),
    ]
    if context_banner is not None:
        set_clauses.append("context_tag = @ctx_tag")
        set_clauses.append("context_title = @ctx_title")
        set_clauses.append("context_body = @ctx_body")
        params.extend([
            bigquery.ScalarQueryParameter("ctx_tag", "STRING", context_banner.get("tag", "")),
            bigquery.ScalarQueryParameter("ctx_title", "STRING", context_banner.get("title", "")),
            bigquery.ScalarQueryParameter("ctx_body", "STRING", context_banner.get("body", "")),
        ])
    if tab2_narrative is not None:
        set_clauses.append("tab2_narrative_tag = @t2_tag")
        set_clauses.append("tab2_narrative_title = @t2_title")
        set_clauses.append("tab2_narrative_body = @t2_body")
        params.extend([
            bigquery.ScalarQueryParameter("t2_tag", "STRING", tab2_narrative.get("tag", "")),
            bigquery.ScalarQueryParameter("t2_title", "STRING", tab2_narrative.get("title", "")),
            bigquery.ScalarQueryParameter("t2_body", "STRING", tab2_narrative.get("body", "")),
        ])
    if len(set_clauses) == 1:
        return
    cli = _client()
    sql = (
        f"UPDATE {SNAPSHOTS} SET "
        + ", ".join(set_clauses)
        + " WHERE slug = @slug AND deleted_at IS NULL"
    )
    cli.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()


def mark_failed(slug: str, message: str) -> None:
    """Marks ONLY the active row (deleted_at IS NULL) as failed.
    Same scoping concern as mark_succeeded — must not blanket-update
    historical rows with this slug.
    """
    cli = _client()
    sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'failed',
          insights_generation_error = @msg,
          updated_at = CURRENT_TIMESTAMP()
      WHERE slug = @slug
        AND deleted_at IS NULL
        AND insights_generation_status = 'generating'
    """
    cli.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("slug", "STRING", slug),
        bigquery.ScalarQueryParameter("msg", "STRING", message[:1000]),
    ])).result()


# ─── data fetchers ─────────────────────────────────────────────────────────


def _rows(sql: str, params: list[bigquery.ScalarQueryParameter] | None = None) -> list[dict[str, Any]]:
    cfg = bigquery.QueryJobConfig(query_parameters=params or [])
    return [dict(r.items()) for r in _client().query(sql, job_config=cfg).result()]


def fetch_webinar_comparison(latest_webinar_date: str, same_weekday_only: bool) -> list[dict[str, Any]]:
    """Anchored on latest_webinar_date (the just-happened webinar) so the
    payload always includes the focus webinar of the report. Was anchored
    on snapshot.week_end which is the prev Sat — one day BEFORE the new Sun
    webinar — which silently dropped the latest event and prevented Claude
    from flagging WoW deltas on it."""
    sql = f"""
      WITH latest AS (
        SELECT MAX(webinar_date) AS d FROM {MART} WHERE webinar_date <= DATE(@latest)
      )
      SELECT FORMAT_DATE('%F', webinar_date) AS webinar_date,
             total_registrants, meta_registrants, manychat_registrants,
             setter_registrants, other_organic_registrants,
             unique_attendees, pitched_attendees,
             reg_to_attend_rate, attend_to_pitched_rate,
             total_webinar_ad_spend, webinar_reg_ad_spend, lp_page_views, lp_opt_in_rate,
             paid_cpr,
             SAFE_DIVIDE(total_webinar_ad_spend, total_registrants) AS blended_cpr,
             blended_cpa, blended_cpbc,
             calls_booked, calls_booked_active, deals_closed, cash_collected,
             roas_cash, roas_revenue, cac,
             reactivation_pool_size, reactivations_attended, reactivations_booked
      FROM {MART}
      WHERE webinar_date <= DATE(@latest)
        AND (
          NOT @same_weekday
          OR EXTRACT(DAYOFWEEK FROM webinar_date) =
             EXTRACT(DAYOFWEEK FROM (SELECT d FROM latest))
        )
      ORDER BY webinar_date DESC
      LIMIT 3
    """
    return _rows(sql, [
        bigquery.ScalarQueryParameter("latest", "STRING", latest_webinar_date),
        bigquery.ScalarQueryParameter("same_weekday", "BOOL", same_weekday_only),
    ])


def fetch_week_funnel(start: str, end: str) -> dict[str, Any]:
    """Mirrors lib/weekly-report-bq.ts::fetchWeekFunnel. Counts DISTINCT
    prospect_email_lc and uses is_* boolean columns from int_calls_enriched."""
    sql = f"""
      SELECT
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
      FROM {ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
    """
    rows = _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])
    return rows[0] if rows else {}


def fetch_closer_overall(start: str, end: str) -> list[dict[str, Any]]:
    """Mirrors lib/weekly-report-bq.ts::fetchCloserOverall."""
    sql = f"""
      SELECT closer_owner AS closer,
             COUNT(DISTINCT prospect_email_lc) AS prospects,
             COUNT(DISTINCT IF(is_dispositioned, prospect_email_lc, NULL)) AS pros_d,
             COUNT(DISTINCT IF(call_outcome='Setter DQ', prospect_email_lc, NULL)) AS setter_dq,
             COUNT(DISTINCT IF(call_outcome='Closer DQ', prospect_email_lc, NULL)) AS closer_dq,
             COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
             COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
             COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL)) AS shows_cq,
             COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
             SUM(IF(is_deal, cash_collected, 0)) AS cash,
             SAFE_DIVIDE(
               COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
               COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))
             ) AS show_rate,
             SAFE_DIVIDE(
               COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)),
               COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))
             ) AS close_rate
      FROM {ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND closer_owner IS NOT NULL
      GROUP BY closer
      ORDER BY deals DESC, cash DESC
    """
    return _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])


def fetch_booking_mode(start: str, end: str) -> list[dict[str, Any]]:
    """Mirrors lib/weekly-report-bq.ts::fetchBookingMode."""
    sql = f"""
      SELECT
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
        SUM(IF(is_deal, cash_collected, 0)) AS cash,
        SAFE_DIVIDE(
          COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
          COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))
        ) AS show_rate,
        SAFE_DIVIDE(
          COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)),
          COUNT(DISTINCT IF(is_close_rate_eligible, prospect_email_lc, NULL))
        ) AS close_rate
      FROM {ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
      GROUP BY source
      ORDER BY prospects DESC
    """
    return _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])


def fetch_setter_performance(start: str, end: str) -> list[dict[str, Any]]:
    """Mirrors lib/weekly-report-bq.ts::fetchSetterPerformance."""
    sql = f"""
      SELECT
        setter_owner AS setter,
        CASE WHEN is_setter_flow THEN 'Setter' WHEN is_webinar_flow THEN 'Webinar' ELSE 'Other' END AS mode,
        COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL)) AS pros_sq,
        COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS shows_sq,
        COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)) AS deals,
        SUM(IF(is_deal, cash_collected, 0)) AS cash,
        SAFE_DIVIDE(
          COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)),
          COUNT(DISTINCT IF(is_show_rate_eligible, prospect_email_lc, NULL))
        ) AS show_rate
      FROM {ENRICHED}
      WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
        AND setter_owner IS NOT NULL
        AND (is_setter_flow OR is_webinar_flow)
      GROUP BY setter, mode
      HAVING pros_sq > 0
      ORDER BY pros_sq DESC, setter, mode
    """
    return _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])


def _safe_pct_delta(this_val: Any, prior_val: Any) -> dict[str, Any]:
    """Pre-computes (this - prior) and (this - prior) / prior * 100 — the
    two numbers Claude is most likely to cite (and most likely to compute
    incorrectly on close calls). Returns None for ratio when prior is 0
    to avoid divide-by-zero in downstream readers.
    """
    try:
        t = float(this_val or 0)
        p = float(prior_val or 0)
    except (TypeError, ValueError):
        return {"this": this_val, "prior": prior_val, "abs_delta": None, "pct_delta": None}
    abs_delta = t - p
    pct_delta = ((t - p) / p * 100) if p != 0 else None
    return {
        "this": t, "prior": p,
        "abs_delta": round(abs_delta, 2),
        "pct_delta": round(pct_delta, 2) if pct_delta is not None else None,
    }


def compute_funnel_wow(this_week: dict[str, Any], prior_week: dict[str, Any]) -> dict[str, Any]:
    """Pre-calculates WoW deltas for every funnel metric. Claude can still
    do math, but with these in hand it doesn't have to — fewer math errors,
    faster output, more consistent insight quoting.
    """
    keys = [
        "prospects", "pros_d", "setter_dq", "closer_dq",
        "pros_sq", "shows_sq", "shows_cq", "deals", "cash", "revenue",
    ]
    return {k: _safe_pct_delta(this_week.get(k), prior_week.get(k)) for k in keys}


def compute_webinar_wow(webinars: list[dict[str, Any]]) -> dict[str, Any]:
    """Pre-calculates WoW deltas for the LATEST webinar vs the one before
    it (positions 0 and 1 in webinars_comparison). Mirrors compute_funnel_wow
    so Claude can cite webinar-quality deltas just as confidently.

    Keys covered: reg_to_attend_rate, attend_to_pitched_rate, lp_opt_in_rate,
    paid_cpr, blended_cpbc, roas_cash, total_registrants, unique_attendees,
    calls_booked, deals_closed, cash_collected.

    Returns empty dict if fewer than 2 webinars available.
    """
    if len(webinars) < 2:
        return {}
    latest, prior = webinars[0], webinars[1]
    keys = [
        "reg_to_attend_rate", "attend_to_pitched_rate", "lp_opt_in_rate",
        "paid_cpr", "blended_cpbc", "blended_cpr", "roas_cash",
        "total_registrants", "unique_attendees", "pitched_attendees",
        "calls_booked", "calls_booked_active", "deals_closed", "cash_collected",
    ]
    return {k: _safe_pct_delta(latest.get(k), prior.get(k)) for k in keys}


def fetch_section_a_money(start: str, end: str) -> dict[str, Any]:
    """Tab 1 Overview / Section A — Fanbasis+Whop money-in + mart_high_level_daily
    aggregates. Mirrors lib/weekly-report-bq-v2.ts::fetchSectionAMoney.

    Note: stg_fanbasis_sales contains BOTH Fanbasis AND Whop transactions
    (~638 + ~143 rows respectively). No platform filter — total money-in.
    Includes installments from prior-month deals.
    """
    sql = f"""
      WITH cash AS (
        SELECT SUM(amount_usd) AS cash_money_in
        FROM {FANBASIS}
        WHERE sale_date BETWEEN DATE(@start) AND DATE(@end)
          AND status = 'succeeded'
      ),
      hl AS (
        SELECT
          SUM(total_revenue_contracted) AS tcv,
          SUM(total_ad_spend)           AS ad_spend,
          SUM(total_deals_closed)       AS deals,
          SUM(count_pif_deals)          AS pif_deals
        FROM {MART_HL_DAILY}
        WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)
      )
      SELECT
        cash.cash_money_in,
        hl.tcv, hl.ad_spend, hl.deals, hl.pif_deals,
        SAFE_DIVIDE(cash.cash_money_in, hl.ad_spend) AS roas_cash,
        SAFE_DIVIDE(hl.tcv, hl.ad_spend)             AS roas_tcv,
        SAFE_DIVIDE(cash.cash_money_in, hl.deals)    AS aov_fanbasis,
        SAFE_DIVIDE(hl.tcv, hl.deals)                AS acv,
        SAFE_DIVIDE(hl.pif_deals, hl.deals)          AS pif_rate,
        SAFE_DIVIDE(cash.cash_money_in, hl.tcv)      AS cash_collection_rate
      FROM cash, hl
    """
    rows = _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])
    return rows[0] if rows else {}


def fetch_section_a_tab3_closer(start: str, end: str) -> dict[str, Any]:
    """Tab 3 "Latest Sales Week" Money — closer-attributed from
    int_calls_enriched (new deals booked this week, NOT money-in).
    Mirrors lib/weekly-report-bq-v2.ts::fetchSectionATab3Closer.
    """
    sql = f"""
      SELECT
        COUNT(DISTINCT IF(is_deal,                     prospect_email_lc, NULL)) AS deals,
        COUNT(DISTINCT IF(is_deal AND is_paid_in_full, prospect_email_lc, NULL)) AS pif_deals,
        SUM(IF(is_deal, cash_collected, 0))                                      AS cash,
        SUM(IF(is_deal, revenue_generated, 0))                                   AS revenue,
        SAFE_DIVIDE(SUM(IF(is_deal, cash_collected, 0)),
                    COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)))        AS aov_closer,
        SAFE_DIVIDE(SUM(IF(is_deal, revenue_generated, 0)),
                    COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)))        AS acv_closer,
        SAFE_DIVIDE(COUNT(DISTINCT IF(is_deal AND is_paid_in_full, prospect_email_lc, NULL)),
                    COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL)))        AS pif_rate_closer,
        SAFE_DIVIDE(SUM(IF(is_deal, cash_collected, 0)),
                    SUM(IF(is_deal, revenue_generated, 0)))                      AS cash_collection_rate_closer
      FROM {ENRICHED}
      WHERE date_closed BETWEEN DATE(@start) AND DATE(@end)
        AND {EMAIL_EXCLUSION}
    """
    rows = _rows(sql, [
        bigquery.ScalarQueryParameter("start", "STRING", start),
        bigquery.ScalarQueryParameter("end", "STRING", end),
    ])
    return rows[0] if rows else {}


def fetch_top_kpis(prev_sun: str, prev_sat: str, latest_webinar_date: str, mw_start: str, mw_end: str) -> dict[str, Any]:
    """The 5 KPI strip values shown at the top of the report — same SQL
    the dashboard uses, so Claude reads exactly what the CEO sees.

    Windows:
      avg_webinar_show_rate → last 3 webinars anchored on latest_webinar_date
      blended_cash_roas    → sales week (Sun-Sat)
      cash_per_booked_call → sales week
      total_calls_booked   → sales week (mart_high_level_daily)
      cost_per_booked_call → sales week (mart_high_level_daily ad_spend / calls)
    """
    show_sql = f"""
      WITH last_three AS (
        SELECT unique_attendees, total_registrants
        FROM {MART}
        WHERE webinar_date <= DATE(@latest)
          AND webinar_day IN ('Sunday', 'Wednesday')
        ORDER BY webinar_date DESC
        LIMIT 3
      )
      SELECT SAFE_DIVIDE(SUM(unique_attendees), NULLIF(SUM(total_registrants), 0)) AS rate
      FROM last_three
    """
    roas_sql = f"""
      WITH c AS (SELECT SUM(amount_usd) AS cash FROM {FANBASIS}
                  WHERE sale_date BETWEEN DATE(@start) AND DATE(@end) AND status='succeeded'),
           s AS (SELECT SUM(total_ad_spend) AS spend, SUM(total_calls_booked) AS calls,
                        SUM(total_calls_booked_active) AS calls_active
                  FROM {MART_HL_DAILY} WHERE metric_date BETWEEN DATE(@start) AND DATE(@end))
      SELECT c.cash, s.spend, s.calls, s.calls_active,
             SAFE_DIVIDE(c.cash, s.spend) AS blended_cash_roas,
             SAFE_DIVIDE(c.cash, s.calls) AS cash_per_booked_call,
             SAFE_DIVIDE(s.spend, s.calls) AS cost_per_booked_call
      FROM c, s
    """
    show_rows = _rows(show_sql, [bigquery.ScalarQueryParameter("latest", "STRING", latest_webinar_date)])
    roas_rows = _rows(roas_sql, [
        bigquery.ScalarQueryParameter("start", "STRING", prev_sun),
        bigquery.ScalarQueryParameter("end", "STRING", prev_sat),
    ])
    show_row = show_rows[0] if show_rows else {}
    roas_row = roas_rows[0] if roas_rows else {}
    return {
        "avg_webinar_show_rate": show_row.get("rate"),
        "avg_webinar_show_rate_scope": "last 3 Sun/Wed webinars (anchored on latest_webinar_date)",
        "blended_cash_roas": roas_row.get("blended_cash_roas"),
        "cash_per_booked_call": roas_row.get("cash_per_booked_call"),
        "cost_per_booked_call": roas_row.get("cost_per_booked_call"),
        "total_calls_booked": roas_row.get("calls"),
        "total_calls_booked_active": roas_row.get("calls_active"),
        "total_ad_spend_sales_week": roas_row.get("spend"),
        "cash_money_in_sales_week": roas_row.get("cash"),
        "scope_note": (
            f"Cash/ROAS/calls window = sales week (Sun-Sat) = {prev_sun}..{prev_sat}. "
            f"Marketing week (Mon-Sun) = {mw_start}..{mw_end}. "
            f"Avg show rate = last 3 webinars."
        ),
    }


def fetch_forecast_bundle(start: str, end: str) -> dict[str, Any]:
    """Pull forecast targets for the report window from nmm_calendar.forecast_targets.
    Mirrors lib/forecast.ts::getForecastBundleForWindow.

    Returns volumes summed across days/channels + rates derived from those
    same sums (so target denominators match actuals denominators). Returns
    a dict with `forecast_id=None` and all values null if no forecast covers
    the window — the table may be empty in non-prod environments.
    """
    sql = f"""
      WITH fid AS (
        SELECT forecast_id
        FROM {FORECAST}
        WHERE period_start <= DATE(@start) AND period_end >= DATE(@end)
        GROUP BY forecast_id
        ORDER BY MAX(created_at) DESC
        LIMIT 1
      ),
      v AS (
        SELECT
          SUM(IF(metric_key='ad_spend',     metric_value, NULL)) AS ad_spend,
          SUM(IF(metric_key='cash',         metric_value, NULL)) AS cash,
          SUM(IF(metric_key='revenue',      metric_value, NULL)) AS revenue,
          SUM(IF(metric_key='deals_closed', metric_value, NULL)) AS deals_closed,
          SUM(IF(metric_key='calls_booked', metric_value, NULL)) AS calls_booked,
          SUM(IF(metric_key='calls_held',   metric_value, NULL)) AS calls_held
        FROM {FORECAST}
        WHERE forecast_id IN (SELECT forecast_id FROM fid)
          AND metric_type = 'volume'
          AND target_date BETWEEN DATE(@start) AND DATE(@end)
      )
      SELECT (SELECT forecast_id FROM fid) AS forecast_id,
             ad_spend, cash, revenue, deals_closed, calls_booked, calls_held,
             SAFE_DIVIDE(calls_held, calls_booked) AS show_rate,
             SAFE_DIVIDE(deals_closed, calls_held) AS close_rate,
             SAFE_DIVIDE(cash, deals_closed)       AS aov
      FROM v
    """
    try:
        rows = _rows(sql, [
            bigquery.ScalarQueryParameter("start", "STRING", start),
            bigquery.ScalarQueryParameter("end", "STRING", end),
        ])
        return rows[0] if rows else {"forecast_id": None}
    except Exception:
        # Table not created in this env, or schema drift — payload still ships.
        return {"forecast_id": None, "error": "forecast_targets unavailable"}


def compute_actual_vs_target(actuals: dict[str, Any], targets: dict[str, Any]) -> dict[str, Any]:
    """Pairs each forecast metric with its sales-week actual + pct of target.

    Returns dict keyed by metric_name with shape:
      { actual: float, target: float, pct_of_target: float, pace_light: 'green'|'orange'|'red'|'unknown' }
    """
    if not targets or targets.get("forecast_id") is None:
        return {"forecast_id": None}
    pairs = {
        "ad_spend":     ("total_ad_spend_sales_week", "ad_spend"),
        "cash":         ("cash_money_in_sales_week",   "cash"),
        "calls_booked": ("total_calls_booked",         "calls_booked"),
    }
    out: dict[str, Any] = {"forecast_id": targets.get("forecast_id")}
    for label, (actual_key, target_key) in pairs.items():
        a = actuals.get(actual_key)
        t = targets.get(target_key)
        try:
            af = float(a) if a is not None else None
            tf = float(t) if t is not None else None
        except (TypeError, ValueError):
            af, tf = None, None
        if af is None or tf is None or tf == 0:
            out[label] = {"actual": af, "target": tf, "pct_of_target": None, "pace_light": "unknown"}
            continue
        pct = af / tf
        light = "green" if pct >= 0.95 else "orange" if pct >= 0.80 else "red"
        out[label] = {
            "actual": round(af, 2),
            "target": round(tf, 2),
            "pct_of_target": round(pct * 100, 1),
            "pace_light": light,
        }
    return out


def assemble_report_payload(slug: str) -> dict[str, Any]:
    """Pulls every table needed for the prompt, keyed for JSON dump.

    Also pre-computes WoW deltas (absolute + percent) on funnel metrics
    and surfaces them under `wow_deltas` so Claude doesn't have to redo
    the math itself.
    """
    snap = fetch_snapshot(slug)
    if snap is None:
        raise ValueError(f"Snapshot {slug!r} not found")
    start = snap["week_start"]
    end = snap["week_end"]
    prior_start = _shift_days(start, -7)
    prior_end = _shift_days(end, -7)
    same_weekday = snap["report_type"] == "midweek_check"
    # Mirror the TS computeWindows logic: for weekly_recap the latest webinar
    # is the Sunday AFTER week_end (Sat); for midweek_check it's week_end (Wed).
    latest_webinar_date = end if same_weekday else _shift_days(end, 1)

    # Marketing week (Mon-Sun) — anchored on the Mon-Sun containing the
    # latest webinar. Webinar/ad-spend metrics live here; sales/cash metrics
    # live on sales week (Sun-Sat).
    lw_date = dt.date.fromisoformat(latest_webinar_date)
    days_to_sun = (6 - lw_date.weekday()) % 7  # weekday(): 0=Mon..6=Sun
    mw_end_date = lw_date + dt.timedelta(days=days_to_sun)
    mw_start_date = mw_end_date - dt.timedelta(days=6)
    mw_start, mw_end = mw_start_date.isoformat(), mw_end_date.isoformat()

    this_week_funnel = fetch_week_funnel(start, end)
    prior_week_funnel = fetch_week_funnel(prior_start, prior_end)
    webinars = fetch_webinar_comparison(latest_webinar_date, same_weekday)
    top_kpis = fetch_top_kpis(start, end, latest_webinar_date, mw_start, mw_end)
    section_a_money = fetch_section_a_money(start, end)
    section_a_tab3_closer = fetch_section_a_tab3_closer(start, end)
    forecast = fetch_forecast_bundle(start, end)

    return {
        "snapshot": {
            "slug": snap["slug"],
            "run_on": snap["run_on"],
            "report_type": snap["report_type"],
            "week_label": snap["week_label"],
            "week_start": start,
            "week_end": end,
            "prior_week_start": prior_start,
            "prior_week_end": prior_end,
            "marketing_week_start": mw_start,
            "marketing_week_end": mw_end,
            "badge": snap["badge"],
            "latest_webinar": snap.get("latest_webinar"),
            "latest_webinar_date": latest_webinar_date,
            "context_banner": {
                "tag": snap.get("context_tag"),
                "title": snap.get("context_title"),
                "body": snap.get("context_body"),
            },
        },
        # ─── Top-of-page KPI strip (the 5 cards above every report) ────────
        "top_kpis": top_kpis,
        # ─── Tab 1 Overview Section A — Fanbasis+Whop money-in basis ──────
        "section_a_money_fanbasis": section_a_money,
        # ─── Tab 3 Latest Sales Week — closer-attributed from int_calls_enriched ─
        "section_a_money_closer": section_a_tab3_closer,
        # ─── Forecast vs target (May 2026 projection model) ───────────────
        "forecast_targets": forecast,
        "actual_vs_target": compute_actual_vs_target(top_kpis, forecast),
        # ─── Webinar data ─────────────────────────────────────────────────
        "webinars_comparison": webinars,
        "webinar_wow_deltas": compute_webinar_wow(webinars),
        # ─── Funnel data (closer-side, sales week) ────────────────────────
        "this_week_funnel": this_week_funnel,
        "prior_week_funnel": prior_week_funnel,
        "wow_deltas": compute_funnel_wow(this_week_funnel, prior_week_funnel),
        "closer_overall": fetch_closer_overall(start, end),
        "booking_mode": fetch_booking_mode(start, end),
        "setter_performance": fetch_setter_performance(start, end),
    }


def insert_insights(slug: str, items: list[dict[str, Any]]) -> int:
    """Wipes any existing AI-generated insights for the slug, then inserts.

    Uses DML INSERT (not streaming insert) so the rows land in managed
    storage immediately and can be UPDATE/DELETE'd by the UI right away.
    Streaming inserts (insert_rows_json) put rows in BQ's streaming buffer
    for ~30-90 min, during which any UPDATE/DELETE fails with
    "would affect rows in the streaming buffer". That broke the inline
    Edit/Delete UX on the dashboard.

    The cleanup UPDATE may itself fail if prior rows are still in the
    buffer from an old streaming-insert run — we swallow that and proceed
    so the new batch still gets inserted. Once the buffer flushes for the
    old rows, a regenerate will clean them out properly.
    """
    cli = _client()
    # Soft-delete prior AI cards for this snapshot. Best-effort.
    try:
        cli.query(
            f"""
            UPDATE {INSIGHTS}
            SET deleted_at = CURRENT_TIMESTAMP()
            WHERE snapshot_slug = @slug
              AND id LIKE 'ai-%'
              AND deleted_at IS NULL
            """,
            job_config=bigquery.QueryJobConfig(query_parameters=[
                bigquery.ScalarQueryParameter("slug", "STRING", slug)
            ]),
        ).result()
    except Exception as e:  # noqa: BLE001
        # Most common cause: prior rows are still in the streaming buffer.
        # Don't fail the whole run — the new INSERT below still proceeds.
        print(f"WARN: prior-row cleanup failed (likely streaming buffer): {e}")

    if not items:
        return 0

    # DML INSERT — single multi-VALUES statement, one DML quota slot.
    placeholders: list[str] = []
    params: list[bigquery.ScalarQueryParameter] = []
    for i, it in enumerate(items):
        placeholders.append(
            f"(@id_{i}, @slug_{i}, @tone_{i}, @tag_{i}, @title_{i}, @body_{i}, @position_{i}, CURRENT_TIMESTAMP())"
        )
        params.extend([
            bigquery.ScalarQueryParameter(f"id_{i}", "STRING", f"ai-{slug}-{i:02d}"),
            bigquery.ScalarQueryParameter(f"slug_{i}", "STRING", slug),
            bigquery.ScalarQueryParameter(f"tone_{i}", "STRING", it["tone"]),
            bigquery.ScalarQueryParameter(f"tag_{i}", "STRING", it["tag"]),
            bigquery.ScalarQueryParameter(f"title_{i}", "STRING", it["title"]),
            bigquery.ScalarQueryParameter(f"body_{i}", "STRING", it["body"]),
            bigquery.ScalarQueryParameter(f"position_{i}", "INT64", int(it.get("position", i))),
        ])

    sql = (
        f"INSERT INTO {INSIGHTS} "
        "(id, snapshot_slug, tone, tag, title, body, position, created_at) VALUES "
        + ", ".join(placeholders)
    )
    cli.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params)).result()
    return len(items)
