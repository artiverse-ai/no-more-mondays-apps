// Forecast read API — projects targets onto arbitrary date windows so the
// UI can render "actual X vs target Y" anywhere a date range is selected.
//
// Storage shape (see lib/forecast-targets-table.ts):
//   - VOLUME metrics live per-day (ad_spend, calls_booked, cash, ...).
//     A window's target = SUM of rows where target_date BETWEEN start AND end.
//   - RATE metrics live once per period (show_rate, close_rate, aov, ...).
//     A window's target = the single value matching the forecast covering
//     the window.

import { bq } from "./bq";
import { FORECAST_TABLE, ensureForecastTargetsTable } from "./forecast-targets-table";

export type ForecastMetricKey =
  | "ad_spend"
  | "cash"
  | "revenue"
  | "deals_closed"
  | "calls_booked"
  | "calls_held"
  | "registrants"
  | "show_rate"
  | "close_rate"
  | "aov_cash"
  | "acv";

export type ForecastWindowResult = {
  /** Sum of per-day volumes overlapping [start, end]. null if no rows. */
  volume: number | null;
  /** Rate from the matching period. null if no row. */
  rate: number | null;
  /** How many distinct days in the window have a target row. */
  daysWithTarget: number;
  /** The forecast id the values were drawn from. */
  forecastId: string | null;
};

export type ForecastResolveOpts = {
  /** Which forecast to read. Defaults to the most recent one that covers [start, end]. */
  forecastId?: string;
  /** Optional channel filter. 'all' (default) sums every channel. */
  channel?: "all" | "webinar" | "setter" | "workshop";
};

/** Pick the freshest forecast whose period brackets the entire window. */
async function pickForecastId(start: string, end: string): Promise<string | null> {
  await ensureForecastTargetsTable();
  const [rows] = await bq().query({
    query: `
      SELECT forecast_id
      FROM ${FORECAST_TABLE}
      WHERE period_start <= @start AND period_end >= @end
      GROUP BY forecast_id
      ORDER BY MAX(created_at) DESC
      LIMIT 1
    `,
    params: { start, end },
    types: { start: "DATE", end: "DATE" },
  });
  return rows[0]?.forecast_id ?? null;
}

/** Resolve volume + rate for a metric over [start, end]. */
export async function getForecastForWindow(
  metric: ForecastMetricKey,
  start: string,
  end: string,
  opts: ForecastResolveOpts = {},
): Promise<ForecastWindowResult> {
  await ensureForecastTargetsTable();
  const forecastId = opts.forecastId ?? (await pickForecastId(start, end));
  if (!forecastId) {
    return { volume: null, rate: null, daysWithTarget: 0, forecastId: null };
  }
  const channelFilter = opts.channel && opts.channel !== "all" ? "AND channel = @channel" : "";
  const [rows] = await bq().query({
    query: `
      WITH window_rows AS (
        SELECT *
        FROM ${FORECAST_TABLE}
        WHERE forecast_id = @forecastId
          AND metric_key = @metric
          ${channelFilter}
      )
      SELECT
        SUM(IF(metric_type = 'volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS volume,
        MAX(IF(metric_type = 'rate', metric_value, NULL)) AS rate,
        COUNT(DISTINCT IF(metric_type = 'volume' AND target_date BETWEEN @start AND @end, target_date, NULL)) AS days_with_target
      FROM window_rows
    `,
    params: {
      forecastId,
      metric,
      start,
      end,
      ...(opts.channel && opts.channel !== "all" ? { channel: opts.channel } : {}),
    },
    types: {
      forecastId: "STRING",
      metric: "STRING",
      start: "DATE",
      end: "DATE",
      ...(opts.channel && opts.channel !== "all" ? { channel: "STRING" } : {}),
    },
  });
  const r = rows[0] ?? {};
  return {
    volume: r.volume == null ? null : Number(r.volume),
    rate: r.rate == null ? null : Number(r.rate),
    daysWithTarget: Number(r.days_with_target ?? 0),
    forecastId,
  };
}

/** Convenience: pull all common metrics for a window in a single round-trip. */
export async function getForecastBundleForWindow(
  start: string,
  end: string,
  opts: ForecastResolveOpts = {},
): Promise<{
  forecastId: string | null;
  ad_spend: number | null;
  cash: number | null;
  revenue: number | null;
  deals_closed: number | null;
  calls_booked: number | null;
  calls_held: number | null;
  show_rate: number | null;
  close_rate: number | null;
  aov_cash: number | null;
}> {
  await ensureForecastTargetsTable();
  const forecastId = opts.forecastId ?? (await pickForecastId(start, end));
  if (!forecastId) {
    return {
      forecastId: null,
      ad_spend: null, cash: null, revenue: null, deals_closed: null,
      calls_booked: null, calls_held: null,
      show_rate: null, close_rate: null, aov_cash: null,
    };
  }
  const [rows] = await bq().query({
    query: `
      SELECT
        SUM(IF(metric_key='ad_spend'      AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS ad_spend,
        SUM(IF(metric_key='cash'          AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS cash,
        SUM(IF(metric_key='revenue'       AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS revenue,
        SUM(IF(metric_key='deals_closed'  AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS deals_closed,
        SUM(IF(metric_key='calls_booked'  AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS calls_booked,
        SUM(IF(metric_key='calls_held'    AND metric_type='volume' AND target_date BETWEEN @start AND @end, metric_value, NULL)) AS calls_held,
        MAX(IF(metric_key='show_rate'  AND metric_type='rate', metric_value, NULL)) AS show_rate,
        MAX(IF(metric_key='close_rate' AND metric_type='rate', metric_value, NULL)) AS close_rate,
        MAX(IF(metric_key='aov_cash'   AND metric_type='rate', metric_value, NULL)) AS aov_cash
      FROM ${FORECAST_TABLE}
      WHERE forecast_id = @forecastId
        AND (channel IS NULL OR channel = 'all' OR channel IN ('webinar','setter','workshop'))
    `,
    params: { forecastId, start, end },
    types: { forecastId: "STRING", start: "DATE", end: "DATE" },
  });
  const r = rows[0] ?? {};
  const num = (v: unknown): number | null => (v == null ? null : Number(v));
  return {
    forecastId,
    ad_spend: num(r.ad_spend),
    cash: num(r.cash),
    revenue: num(r.revenue),
    deals_closed: num(r.deals_closed),
    calls_booked: num(r.calls_booked),
    calls_held: num(r.calls_held),
    show_rate: num(r.show_rate),
    close_rate: num(r.close_rate),
    aov_cash: num(r.aov_cash),
  };
}

/** Classify pace as green/orange/red based on % of target hit. */
export function paceLight(actual: number | null, target: number | null): {
  pct: number | null;
  light: "green" | "orange" | "red" | "unknown";
} {
  if (actual == null || target == null || target === 0) {
    return { pct: null, light: "unknown" };
  }
  const pct = actual / target;
  if (pct >= 0.95) return { pct, light: "green" };
  if (pct >= 0.8) return { pct, light: "orange" };
  return { pct, light: "red" };
}
