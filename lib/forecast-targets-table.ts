// Schema + setup for nmm_calendar.forecast_targets — projection targets
// keyed by (forecast_id, metric_key, channel, target_date). Volumes are
// stored per-day (or per-event); rates are stored once per period.
//
// Read access: lib/forecast.ts (getForecastForWindow, etc.)
// Write access: scripts/seed-forecast-*.mjs or /api/admin/seed-forecast.

import { bq, BQ_PROJECT, BQ_DATASET } from "./bq";

export const FORECAST_TABLE = `\`${BQ_PROJECT}.${BQ_DATASET}.forecast_targets\``;

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS ${FORECAST_TABLE} (
  -- Identity
  forecast_id    STRING NOT NULL,           -- e.g. 'may-2026-v1' — new version = new id
  metric_key     STRING NOT NULL,           -- canonical key (see lib/forecast-metrics.ts)
  metric_type    STRING NOT NULL,           -- 'volume' | 'rate'
  channel        STRING,                    -- 'all' | 'webinar' | 'setter' | 'workshop'
  event_label    STRING,                    -- 'FCW Sun' | 'FCW Wed' | 'Monthly Workshop' | NULL

  -- Time
  target_date    DATE,                      -- per-day target_date; NULL for rates
  period_start   DATE NOT NULL,             -- forecast scope (always set)
  period_end     DATE NOT NULL,

  -- Value
  metric_value   FLOAT64 NOT NULL,
  notes          STRING,

  -- Bookkeeping
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by     STRING
)
PARTITION BY period_start
CLUSTER BY forecast_id, metric_key
`;

let _setupPromise: Promise<void> | null = null;

/** Idempotent — creates the table if missing. Memoized. */
export function ensureForecastTargetsTable(): Promise<void> {
  if (_setupPromise) return _setupPromise;
  _setupPromise = (async () => {
    await bq().query({ query: CREATE_SQL });
  })();
  return _setupPromise;
}

export type ForecastTargetRow = {
  forecast_id: string;
  metric_key: string;
  metric_type: "volume" | "rate";
  channel: string | null;
  event_label: string | null;
  target_date: string | null;     // YYYY-MM-DD
  period_start: string;
  period_end: string;
  metric_value: number;
  notes: string | null;
  created_by: string | null;
};

/**
 * Insert rows. Caller must MERGE/DELETE first if replacing — we don't dedup
 * here. Forecast versioning is done by creating a new `forecast_id`.
 */
export async function insertForecastTargets(rows: ForecastTargetRow[]): Promise<void> {
  if (rows.length === 0) return;
  await ensureForecastTargetsTable();
  await bq()
    .dataset(BQ_DATASET)
    .table("forecast_targets")
    .insert(rows, { ignoreUnknownValues: false, skipInvalidRows: false });
}

/** Soft-replace: delete all rows for a forecast_id, then insert fresh. */
export async function replaceForecast(
  forecastId: string,
  rows: ForecastTargetRow[],
): Promise<void> {
  await ensureForecastTargetsTable();
  await bq().query({
    query: `DELETE FROM ${FORECAST_TABLE} WHERE forecast_id = @id`,
    params: { id: forecastId },
    types: { id: "STRING" },
  });
  await insertForecastTargets(rows);
}
