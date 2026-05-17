// Seed (or re-seed) the May 2026 forecast into BigQuery.
//
// Usage:
//   npx tsx scripts/seed-may-2026-forecast.ts --dry-run    # verify only
//   npx tsx scripts/seed-may-2026-forecast.ts              # verify + seed + readback
//
// Requires GOOGLE_APPLICATION_CREDENTIALS pointing to the
// shahriar-s-service-account key. The script:
//   1) Builds the in-memory rows from lib/forecast-seeds/may-2026.ts
//   2) Re-derives every CSV total from those rows (PASS/FAIL per check)
//   3) (unless --dry-run) DELETEs any existing rows with this forecast_id and
//      INSERTs the fresh set
//   4) Reads back the BQ totals and asserts they match the source CSV again

import { BigQuery } from "@google-cloud/bigquery";
import { buildMay2026Rows, MAY_2026_FORECAST_ID } from "../lib/forecast-seeds/may-2026";

const DRY_RUN = process.argv.includes("--dry-run");
const PROJECT = process.env.BQ_PROJECT ?? "no-more-mondays-analytics";
const DATASET = process.env.BQ_DATASET ?? "nmm_calendar";
const TABLE = "forecast_targets";
const FQ = `\`${PROJECT}.${DATASET}.${TABLE}\``;

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS ${FQ} (
  forecast_id    STRING NOT NULL,
  metric_key     STRING NOT NULL,
  metric_type    STRING NOT NULL,
  channel        STRING,
  event_label    STRING,
  target_date    DATE,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  metric_value   FLOAT64 NOT NULL,
  notes          STRING,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  created_by     STRING
)
PARTITION BY period_start
CLUSTER BY forecast_id, metric_key
`;

const bq = new BigQuery({ projectId: PROJECT });

async function main() {
// ─────────────────────────────────────────────────────────────────────
// Step 1: build + in-memory verify
// ─────────────────────────────────────────────────────────────────────
const rows = buildMay2026Rows("seed-script");
console.log(`\n📦 Built ${rows.length} rows for forecast_id='${MAY_2026_FORECAST_ID}'\n`);

const sum = (predicate: (r: typeof rows[number]) => boolean) =>
  rows.filter(predicate).reduce((s, r) => s + r.metric_value, 0);
const approxEq = (a: number, b: number, eps = 0.6) => Math.abs(a - b) <= eps;

type Check = { label: string; expected: number; actual: number };
const inMemoryChecks: Check[] = [
  { label: "Webinar funnel ad spend",      expected: 28755, actual: sum((r) => r.metric_key === "ad_spend" && r.channel === "webinar") },
  { label: "Setter funnel ad spend",       expected:  8435, actual: sum((r) => r.metric_key === "ad_spend" && r.channel === "setter") },
  { label: "TOTAL ad spend",               expected: 37190, actual: sum((r) => r.metric_key === "ad_spend") },
  { label: "Webinar+workshop calls booked", expected:  305, actual: sum((r) => r.metric_key === "calls_booked" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "Setter calls booked",          expected:    57, actual: sum((r) => r.metric_key === "calls_booked" && r.channel === "setter") },
  { label: "TOTAL calls booked",           expected:   362, actual: sum((r) => r.metric_key === "calls_booked") },
  { label: "Webinar+workshop calls held",  expected: 133.5, actual: sum((r) => r.metric_key === "calls_held" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "Setter calls held",            expected:    25, actual: sum((r) => r.metric_key === "calls_held" && r.channel === "setter") },
  { label: "TOTAL calls held",             expected: 158.5, actual: sum((r) => r.metric_key === "calls_held") },
  { label: "Webinar+workshop deals closed", expected:   36, actual: sum((r) => r.metric_key === "deals_closed" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "Setter deals closed",          expected:   8.3, actual: sum((r) => r.metric_key === "deals_closed" && r.channel === "setter") },
  { label: "TOTAL deals closed",           expected:  44.3, actual: sum((r) => r.metric_key === "deals_closed") },
  { label: "Webinar+workshop cash",        expected:109045, actual: sum((r) => r.metric_key === "cash" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "Setter cash",                  expected: 24800, actual: sum((r) => r.metric_key === "cash" && r.channel === "setter") },
  { label: "TOTAL cash May 17-31",         expected:133845, actual: sum((r) => r.metric_key === "cash") },
  { label: "Webinar+workshop revenue",     expected:149375, actual: sum((r) => r.metric_key === "revenue" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "Setter revenue",               expected: 33814, actual: sum((r) => r.metric_key === "revenue" && r.channel === "setter") },
  { label: "TOTAL revenue May 17-31",      expected:183189, actual: sum((r) => r.metric_key === "revenue") },
];

let failed = 0;
console.log("In-memory checks (re-derived from seed rows):");
for (const c of inMemoryChecks) {
  const ok = approxEq(c.actual, c.expected);
  if (!ok) failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.label.padEnd(36)}  expected ${c.expected.toLocaleString().padStart(8)}   got ${c.actual.toLocaleString(undefined, { maximumFractionDigits: 2 }).padStart(8)}`);
}
if (failed > 0) {
  console.error(`\n❌ ${failed} in-memory check(s) failed. Aborting.\n`);
  process.exit(1);
}

const totalBooked = sum((r) => r.metric_key === "calls_booked");
const totalHeld   = sum((r) => r.metric_key === "calls_held");
const totalClosed = sum((r) => r.metric_key === "deals_closed");
const totalCash   = sum((r) => r.metric_key === "cash");
console.log("\nDerived rates (what bundle query will return for May 17-31 window):");
console.log(`    show_rate  = ${(totalHeld / totalBooked * 100).toFixed(1)}%   (= ${totalHeld} / ${totalBooked})`);
console.log(`    close_rate = ${(totalClosed / totalHeld * 100).toFixed(1)}%   (= ${totalClosed.toFixed(1)} / ${totalHeld})`);
console.log(`    aov_cash   = $${(totalCash / totalClosed).toFixed(0)}   (= $${totalCash.toLocaleString()} / ${totalClosed.toFixed(1)})`);

if (DRY_RUN) {
  console.log("\n✅ --dry-run: in-memory verification passed. No BQ writes.\n");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: ensure table + write
// ─────────────────────────────────────────────────────────────────────
console.log(`\n🔧 Ensuring table exists: ${FQ}`);
await bq.query({ query: CREATE_SQL });

console.log(`🗑  Deleting any existing rows with forecast_id='${MAY_2026_FORECAST_ID}'`);
const [deleteJob] = await bq.createQueryJob({
  query: `DELETE FROM ${FQ} WHERE forecast_id = @id`,
  params: { id: MAY_2026_FORECAST_ID },
  types: { id: "STRING" },
});
await deleteJob.getQueryResults();

console.log(`📤 Inserting ${rows.length} rows...`);
await bq.dataset(DATASET).table(TABLE).insert(rows, {
  ignoreUnknownValues: false,
  skipInvalidRows: false,
});

// ─────────────────────────────────────────────────────────────────────
// Step 3: read-back verification (BigQuery streaming insert is eventually
// consistent — small wait so the SELECT can see the rows)
// ─────────────────────────────────────────────────────────────────────
console.log(`\n⏳ Waiting 6s for streaming buffer to commit...`);
await new Promise((r) => setTimeout(r, 6000));

const [bqRows] = await bq.query({
  query: `
    SELECT
      SUM(IF(metric_key='ad_spend',     metric_value, NULL)) AS ad_spend,
      SUM(IF(metric_key='cash',         metric_value, NULL)) AS cash,
      SUM(IF(metric_key='revenue',      metric_value, NULL)) AS revenue,
      SUM(IF(metric_key='deals_closed', metric_value, NULL)) AS deals_closed,
      SUM(IF(metric_key='calls_booked', metric_value, NULL)) AS calls_booked,
      SUM(IF(metric_key='calls_held',   metric_value, NULL)) AS calls_held,
      COUNT(*) AS row_count
    FROM ${FQ}
    WHERE forecast_id = @id AND metric_type = 'volume'
  `,
  params: { id: MAY_2026_FORECAST_ID },
  types: { id: "STRING" },
});
const bqRow = bqRows[0] ?? {};
console.log(`\n📊 BQ read-back:`);
console.log(`    row_count    = ${bqRow.row_count}`);
console.log(`    ad_spend     = $${Number(bqRow.ad_spend ?? 0).toLocaleString()}`);
console.log(`    cash         = $${Number(bqRow.cash ?? 0).toLocaleString()}`);
console.log(`    revenue      = $${Number(bqRow.revenue ?? 0).toLocaleString()}`);
console.log(`    deals_closed = ${Number(bqRow.deals_closed ?? 0).toFixed(1)}`);
console.log(`    calls_booked = ${Number(bqRow.calls_booked ?? 0)}`);
console.log(`    calls_held   = ${Number(bqRow.calls_held ?? 0)}`);

const bqChecks: Check[] = [
  { label: "BQ ad_spend",     expected: 37190, actual: Number(bqRow.ad_spend ?? 0) },
  { label: "BQ cash",         expected: 133845, actual: Number(bqRow.cash ?? 0) },
  { label: "BQ revenue",      expected: 183189, actual: Number(bqRow.revenue ?? 0) },
  { label: "BQ deals_closed", expected: 44.3, actual: Number(bqRow.deals_closed ?? 0) },
  { label: "BQ calls_booked", expected: 362, actual: Number(bqRow.calls_booked ?? 0) },
  { label: "BQ calls_held",   expected: 158.5, actual: Number(bqRow.calls_held ?? 0) },
];

let bqFailed = 0;
console.log("");
for (const c of bqChecks) {
  const ok = approxEq(c.actual, c.expected);
  if (!ok) bqFailed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.label.padEnd(30)}  expected ${c.expected.toLocaleString().padStart(10)}   got ${c.actual.toLocaleString(undefined, { maximumFractionDigits: 2 }).padStart(10)}`);
}

if (bqFailed > 0) {
  console.error(`\n❌ ${bqFailed} BQ read-back check(s) failed.\n`);
  process.exit(1);
}

console.log(`\n✅ Seed complete. ${rows.length} rows in ${FQ} for forecast_id='${MAY_2026_FORECAST_ID}'\n`);
}

main().catch((err) => {
  console.error("\n❌ Seed script crashed:", err);
  process.exit(1);
});
