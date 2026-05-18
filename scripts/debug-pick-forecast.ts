// Direct test of the pickForecastId SQL via bq client

import { BigQuery } from "@google-cloud/bigquery";

const PROJECT = process.env.BQ_PROJECT ?? "no-more-mondays-analytics";
const DATASET = process.env.BQ_DATASET ?? "nmm_calendar";
const FQ = `\`${PROJECT}.${DATASET}.forecast_targets\``;
const bq = new BigQuery({ projectId: PROJECT });

async function main() {
  // 1. raw: which forecasts exist + their periods + created_at
  console.log("\n=== All forecasts in BQ ===");
  const [forecasts] = await bq.query({
    query: `SELECT forecast_id, period_start, period_end, MAX(created_at) AS latest_created FROM ${FQ} GROUP BY 1, 2, 3 ORDER BY latest_created DESC`,
  });
  console.log(JSON.stringify(forecasts, null, 2));

  // 2. pickForecastId logic — exactly as lib/forecast.ts does it
  console.log("\n=== pickForecastId('2026-05-10', '2026-05-16') ===");
  const [picks] = await bq.query({
    query: `
      SELECT forecast_id
      FROM ${FQ}
      WHERE period_start <= @start AND period_end >= @end
      GROUP BY forecast_id
      ORDER BY MAX(created_at) DESC
      LIMIT 1
    `,
    params: { start: "2026-05-10", end: "2026-05-16" },
    types: { start: "DATE", end: "DATE" },
  });
  console.log(`Result: ${JSON.stringify(picks)}`);
  console.log(`First row's forecast_id: ${picks[0]?.forecast_id ?? "NULL"}`);

  // 3. Same query, hardcoded values (no params)
  console.log("\n=== HARDCODED dates (no params) ===");
  const [picks2] = await bq.query({
    query: `
      SELECT forecast_id, MIN(period_start) AS ps, MAX(period_end) AS pe
      FROM ${FQ}
      WHERE period_start <= DATE('2026-05-10') AND period_end >= DATE('2026-05-16')
      GROUP BY forecast_id
      ORDER BY MAX(created_at) DESC
      LIMIT 5
    `,
  });
  console.log(JSON.stringify(picks2, null, 2));

  // 4. STRING params with explicit DATE() cast in SQL
  console.log("\n=== STRING params + DATE() cast ===");
  const [picks3] = await bq.query({
    query: `
      SELECT forecast_id
      FROM ${FQ}
      WHERE period_start <= DATE(@start) AND period_end >= DATE(@end)
      GROUP BY forecast_id
      ORDER BY MAX(created_at) DESC
      LIMIT 1
    `,
    params: { start: "2026-05-10", end: "2026-05-16" },
    types: { start: "STRING", end: "STRING" },
  });
  console.log(JSON.stringify(picks3));
}

main().catch((err) => { console.error(err); process.exit(1); });
