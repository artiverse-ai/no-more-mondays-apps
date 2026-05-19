// Seeds forecast_id 'may-2026-v3' with:
//   • Past (May 1-16): per-day ACTUALS from int_calls_enriched + mart_high_level_daily
//     so target = actual for every past date. Chips read 100% for completed
//     past windows by design — the user's explicit ask: "if some day does
//     not have target in the past keep the target as the actual value".
//   • Future (May 17-31): unchanged per-event + per-day projections from
//     buildMay2026Rows (filtered to >= 2026-05-17).
//
// Run:
//   GOOGLE_APPLICATION_CREDENTIALS=...adc.json npx tsx scripts/seed-may-2026-v3-actuals-as-targets.ts
//
// After running, the bundle query auto-picks v3 (most recent forecast).
// Old v1/v2 stay for audit but are no longer chosen.

import { BigQuery } from "@google-cloud/bigquery";
import { buildMay2026Rows } from "../lib/forecast-seeds/may-2026";
import type { ForecastTargetRow } from "../lib/forecast-targets-table";

const FORECAST_ID = "may-2026-v5";   // v5 = past actuals + future projections + CSV operating rate goals
const PERIOD_START = "2026-05-01";
const PERIOD_END = "2026-05-31";
const PAST_END = "2026-05-16";
const FUTURE_START = "2026-05-17";

const PROJECT = process.env.BQ_PROJECT ?? "no-more-mondays-analytics";
const DATASET = process.env.BQ_DATASET ?? "nmm_calendar";
const FQ = `\`${PROJECT}.${DATASET}.forecast_targets\``;
const bq = new BigQuery({ projectId: PROJECT });

async function main() {
  // ─── 1) PAST: per-day actuals from int_calls_enriched + mart_high_level_daily
  console.log(`📊 Querying per-day actuals for ${PERIOD_START}..${PAST_END}...`);
  const [actuals] = await bq.query({
    query: `
      WITH calls AS (
        SELECT
          date_closed AS d,
          SUM(IF(is_deal, cash_collected, 0))                           AS cash,
          SUM(IF(is_deal, revenue_generated, 0))                        AS revenue,
          COUNT(DISTINCT IF(is_deal, prospect_email_lc, NULL))          AS deals,
          COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL))       AS calls_held
        FROM \`${PROJECT}.dbt_tuddin.int_calls_enriched\`
        WHERE date_closed BETWEEN DATE(@start) AND DATE(@end)
          AND prospect_email_lc NOT LIKE '%@nomoremondays.io%'
          AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')
        GROUP BY 1
      ),
      mart AS (
        SELECT
          metric_date AS d,
          SUM(total_ad_spend)     AS ad_spend,
          SUM(total_calls_booked) AS calls_booked
        FROM \`${PROJECT}.dbt_tuddin.mart_high_level_daily\`
        WHERE metric_date BETWEEN DATE(@start) AND DATE(@end)
        GROUP BY 1
      ),
      shows AS (
        -- Calls HELD by appointment date (different from date_closed)
        SELECT
          DATE(appointment_date_time) AS d,
          COUNT(DISTINCT IF(is_show_up, prospect_email_lc, NULL)) AS calls_held
        FROM \`${PROJECT}.dbt_tuddin.int_calls_enriched\`
        WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
          AND prospect_email_lc NOT LIKE '%@nomoremondays.io%'
          AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')
        GROUP BY 1
      )
      SELECT
        FORMAT_DATE('%F', d) AS dt,
        ad_spend, cash, revenue, deals, calls_booked, calls_held
      FROM (
        SELECT
          COALESCE(c.d, m.d, s.d)         AS d,
          IFNULL(m.ad_spend, 0)           AS ad_spend,
          IFNULL(c.cash, 0)               AS cash,
          IFNULL(c.revenue, 0)            AS revenue,
          IFNULL(c.deals, 0)              AS deals,
          IFNULL(m.calls_booked, 0)       AS calls_booked,
          IFNULL(s.calls_held, 0)         AS calls_held
        FROM calls c
        FULL OUTER JOIN mart m  ON c.d = m.d
        FULL OUTER JOIN shows s ON COALESCE(c.d, m.d) = s.d
      )
      WHERE d IS NOT NULL
      ORDER BY d
    `,
    params: { start: PERIOD_START, end: PAST_END },
    types: { start: "STRING", end: "STRING" },
  });

  console.log(`   → ${actuals.length} past days with actuals`);

  const pastRows: ForecastTargetRow[] = [];
  for (const r of actuals as Array<Record<string, unknown>>) {
    const d = String(r.dt);
    const base = {
      forecast_id: FORECAST_ID,
      period_start: PERIOD_START,
      period_end: PERIOD_END,
      created_by: "v3-actuals-script",
      target_date: d,
      channel: "actual",
      event_label: null,
      metric_type: "volume" as const,
      notes: "Past actual (from int_calls_enriched + mart_high_level_daily) — target = actual so past-window chips always read 100%",
    };
    pastRows.push({ ...base, metric_key: "ad_spend",     metric_value: Number(r.ad_spend     ?? 0) });
    pastRows.push({ ...base, metric_key: "cash",         metric_value: Number(r.cash         ?? 0) });
    pastRows.push({ ...base, metric_key: "revenue",      metric_value: Number(r.revenue      ?? 0) });
    pastRows.push({ ...base, metric_key: "deals_closed", metric_value: Number(r.deals        ?? 0) });
    pastRows.push({ ...base, metric_key: "calls_booked", metric_value: Number(r.calls_booked ?? 0) });
    pastRows.push({ ...base, metric_key: "calls_held",   metric_value: Number(r.calls_held   ?? 0) });
  }
  console.log(`   → ${pastRows.length} past rows built`);

  // ─── 2) FUTURE projections + ALL rate constants (incl. blended targets)
  //         from buildMay2026Rows. Past per-day rows are filtered out
  //         because we already built them as actuals in step 1 above.
  //         monthly_total rows are kept too (harmless — bundle ignores them).
  const allBuilt = buildMay2026Rows("v5-actuals-script");
  const futureRows = allBuilt
    .filter((r) => r.target_date == null || r.target_date >= FUTURE_START)
    .map((r) => ({ ...r, forecast_id: FORECAST_ID }));
  console.log(`📈 ${futureRows.length} future + rate-constant + monthly-total rows`);

  // ─── 3) Insert all rows as v3
  const allRows = [...pastRows, ...futureRows];
  console.log(`\n📤 Inserting ${allRows.length} rows into ${FQ} for forecast_id='${FORECAST_ID}'...`);
  await bq.dataset(DATASET).table("forecast_targets").insert(allRows, {
    ignoreUnknownValues: false,
    skipInvalidRows: false,
  });

  console.log(`⏳ Waiting 6s for streaming buffer to commit...`);
  await new Promise((r) => setTimeout(r, 6000));

  // ─── 4) Read-back sanity check
  const [rb] = await bq.query({
    query: `
      SELECT
        SUM(IF(metric_key='ad_spend',     metric_value, NULL)) AS ad_spend_full,
        SUM(IF(metric_key='cash',         metric_value, NULL)) AS cash_full,
        SUM(IF(metric_key='revenue',      metric_value, NULL)) AS revenue_full,
        SUM(IF(metric_key='deals_closed', metric_value, NULL)) AS deals_full,
        SUM(IF(metric_key='calls_booked', metric_value, NULL)) AS calls_full,
        SUM(IF(metric_key='cash' AND target_date BETWEEN '2026-05-10' AND '2026-05-16', metric_value, NULL)) AS cash_510_516,
        COUNT(*) AS row_count
      FROM ${FQ}
      WHERE forecast_id = @id AND metric_type = 'volume'
    `,
    params: { id: FORECAST_ID },
    types: { id: "STRING" },
  });
  const r = rb[0] ?? {};
  console.log(`\n📊 BQ read-back (forecast_id='${FORECAST_ID}'):`);
  console.log(`   row_count                = ${r.row_count}`);
  console.log(`   ad_spend (full May)      = $${Number(r.ad_spend_full ?? 0).toLocaleString()}`);
  console.log(`   cash     (full May)      = $${Number(r.cash_full ?? 0).toLocaleString()}`);
  console.log(`   revenue  (full May)      = $${Number(r.revenue_full ?? 0).toLocaleString()}`);
  console.log(`   deals    (full May)      = ${Number(r.deals_full ?? 0)}`);
  console.log(`   booked   (full May)      = ${Number(r.calls_full ?? 0)}`);
  console.log(`   cash     (May 10-16)     = $${Number(r.cash_510_516 ?? 0).toLocaleString()}`);
  console.log(`\n✅ Done. Bundle query will now pick '${FORECAST_ID}' (most recent) automatically.`);
}

main().catch((err) => {
  console.error("\n❌ Script crashed:", err);
  process.exit(1);
});
