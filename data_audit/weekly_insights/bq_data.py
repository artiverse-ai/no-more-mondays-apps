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
SNAPSHOTS = f"`{PROJECT}.{DATASET}.weekly_report_snapshots`"
INSIGHTS = f"`{PROJECT}.{DATASET}.weekly_report_insights`"
CLOSERS = f"`{PROJECT}.{DATASET}.closers`"


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


def claim_pending() -> dict[str, Any] | None:
    """
    Atomically pick one 'pending' snapshot, flip it to 'generating', and
    return it. Returns None if the queue is empty.
    """
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


def mark_succeeded(slug: str) -> None:
    cli = _client()
    sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'succeeded',
          insights_generation_error = NULL,
          insights_generated_at = CURRENT_TIMESTAMP(),
          updated_at = CURRENT_TIMESTAMP()
      WHERE slug = @slug
    """
    cli.query(sql, job_config=bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("slug", "STRING", slug)]
    )).result()


def mark_failed(slug: str, message: str) -> None:
    cli = _client()
    sql = f"""
      UPDATE {SNAPSHOTS}
      SET insights_generation_status = 'failed',
          insights_generation_error = @msg,
          updated_at = CURRENT_TIMESTAMP()
      WHERE slug = @slug
    """
    cli.query(sql, job_config=bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("slug", "STRING", slug),
        bigquery.ScalarQueryParameter("msg", "STRING", message[:1000]),
    ])).result()


# ─── data fetchers ─────────────────────────────────────────────────────────


def _rows(sql: str, params: list[bigquery.ScalarQueryParameter] | None = None) -> list[dict[str, Any]]:
    cfg = bigquery.QueryJobConfig(query_parameters=params or [])
    return [dict(r.items()) for r in _client().query(sql, job_config=cfg).result()]


def fetch_webinar_comparison(week_end: str, same_weekday_only: bool) -> list[dict[str, Any]]:
    sql = f"""
      WITH latest AS (
        SELECT MAX(webinar_date) AS d FROM {MART} WHERE webinar_date <= DATE(@end)
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
      WHERE webinar_date <= DATE(@end)
        AND (
          NOT @same_weekday
          OR EXTRACT(DAYOFWEEK FROM webinar_date) =
             EXTRACT(DAYOFWEEK FROM (SELECT d FROM latest))
        )
      ORDER BY webinar_date DESC
      LIMIT 3
    """
    return _rows(sql, [
        bigquery.ScalarQueryParameter("end", "STRING", week_end),
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


def assemble_report_payload(slug: str) -> dict[str, Any]:
    """Pulls every table needed for the prompt, keyed for JSON dump."""
    snap = fetch_snapshot(slug)
    if snap is None:
        raise ValueError(f"Snapshot {slug!r} not found")
    start = snap["week_start"]
    end = snap["week_end"]
    prior_start = _shift_days(start, -7)
    prior_end = _shift_days(end, -7)
    same_weekday = snap["report_type"] == "midweek_check"

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
            "badge": snap["badge"],
            "latest_webinar": snap.get("latest_webinar"),
            "context_banner": {
                "tag": snap.get("context_tag"),
                "title": snap.get("context_title"),
                "body": snap.get("context_body"),
            },
        },
        "webinars_comparison": fetch_webinar_comparison(end, same_weekday),
        "this_week_funnel": fetch_week_funnel(start, end),
        "prior_week_funnel": fetch_week_funnel(prior_start, prior_end),
        "closer_overall": fetch_closer_overall(start, end),
        "booking_mode": fetch_booking_mode(start, end),
        "setter_performance": fetch_setter_performance(start, end),
    }


def insert_insights(slug: str, items: list[dict[str, Any]]) -> int:
    """Wipes any existing AI-generated insights for the slug, then inserts.

    Uses INSERT (not MERGE) — the prior cards are soft-deleted first so the
    page shows the fresh batch only. Manual insights added through the UI
    are preserved because they have non-ai IDs (uuid). The 'ai-{slug}-{i}'
    naming makes the difference explicit.
    """
    cli = _client()
    # Soft-delete prior AI cards for this snapshot.
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

    rows = []
    for i, it in enumerate(items):
        rows.append({
            "id": f"ai-{slug}-{i:02d}",
            "snapshot_slug": slug,
            "tone": it["tone"],
            "tag": it["tag"],
            "title": it["title"],
            "body": it["body"],
            "position": int(it.get("position", i)),
            "created_at": dt.datetime.utcnow().isoformat() + "Z",
        })

    table = cli.get_table(f"{PROJECT}.{DATASET}.weekly_report_insights")
    errors = cli.insert_rows_json(table, rows)
    if errors:
        raise RuntimeError(f"BQ insert errors: {errors}")
    return len(rows)
