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
const isFuture = (r: typeof rows[number]) => r.target_date != null && r.target_date >= "2026-05-17";
const isPast = (r: typeof rows[number]) => r.target_date != null && r.target_date < "2026-05-17";
const inMemoryChecks: Check[] = [
  // ── Future half (May 17-31) — original CSV "Projected" numbers ─────
  { label: "[5/17-31] Webinar funnel ad spend",      expected: 28755, actual: sum((r) => isFuture(r) && r.metric_key === "ad_spend" && r.channel === "webinar") },
  { label: "[5/17-31] Setter funnel ad spend",       expected:  8435, actual: sum((r) => isFuture(r) && r.metric_key === "ad_spend" && r.channel === "setter") },
  { label: "[5/17-31] TOTAL ad spend",               expected: 37190, actual: sum((r) => isFuture(r) && r.metric_key === "ad_spend") },
  { label: "[5/17-31] Webinar+workshop booked",      expected:   305, actual: sum((r) => isFuture(r) && r.metric_key === "calls_booked" && (r.channel === "webinar" || r.channel === "workshop")) },
  { label: "[5/17-31] Setter booked",                expected:    57, actual: sum((r) => isFuture(r) && r.metric_key === "calls_booked" && r.channel === "setter") },
  { label: "[5/17-31] TOTAL booked",                 expected:   362, actual: sum((r) => isFuture(r) && r.metric_key === "calls_booked") },
  { label: "[5/17-31] TOTAL cash",                   expected:133845, actual: sum((r) => isFuture(r) && r.metric_key === "cash") },
  { label: "[5/17-31] TOTAL revenue",                expected:183189, actual: sum((r) => isFuture(r) && r.metric_key === "revenue") },
  { label: "[5/17-31] TOTAL deals closed",           expected:  44.3, actual: sum((r) => isFuture(r) && r.metric_key === "deals_closed") },
  // ── Past half (May 1-16) — backfilled CSV "Actual" numbers ─────────
  { label: "[5/1-16] Past webinar ad spend",         expected: 22969, actual: sum((r) => isPast(r) && r.metric_key === "ad_spend" && r.channel === "webinar") },
  { label: "[5/1-16] Past non-webinar ad spend",     expected: 10697, actual: sum((r) => isPast(r) && r.metric_key === "ad_spend" && r.channel === "setter") },
  { label: "[5/1-16] Past TOTAL ad spend",           expected: 33666, actual: sum((r) => isPast(r) && r.metric_key === "ad_spend"), },
  { label: "[5/1-16] Past 4 webinars deals",         expected:    36, actual: sum((r) => isPast(r) && r.metric_key === "deals_closed" && r.channel === "webinar") },
  { label: "[5/1-16] Past setter deals",             expected:    13, actual: sum((r) => isPast(r) && r.metric_key === "deals_closed" && r.channel === "setter") },
  { label: "[5/1-16] Past 4 webinars cash",          expected: 34979, actual: sum((r) => isPast(r) && r.metric_key === "cash" && r.channel === "webinar") },
  { label: "[5/1-16] Past setter cash",              expected: 38840, actual: sum((r) => isPast(r) && r.metric_key === "cash" && r.channel === "setter") },
  // ── Full month sanity ──────────────────────────────────────────────
  { label: "[Full May] TOTAL ad spend",              expected:  70856, actual: sum((r) => r.metric_key === "ad_spend") },
  { label: "[Full May] TOTAL cash",                  expected: 242542, actual: sum((r) => r.metric_key === "cash") },
  { label: "[Full May] TOTAL revenue",               expected: 332081, actual: sum((r) => r.metric_key === "revenue") }, // CSV stated 332,267 — its own sum is 332,081 (148,892 + 183,189). Match the periods.
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

console.log(`📤 Inserting ${rows.length} rows for forecast_id='${MAY_2026_FORECAST_ID}'...`);
// Using streaming insert. Safe here because we use a fresh forecast_id
// (e.g., may-2026-v2 supersedes v1) — no DELETE needed, so the streaming
// buffer doesn't cause issues. Old v1 rows can stay; the bundle query
// picks the most recent forecast_id by created_at.
await bq.dataset(DATASET).table(TABLE).insert(rows, {
  ignoreUnknownValues: false,
  skipInvalidRows: false,
});

console.log(`\n⏳ Waiting 6s for streaming buffer to commit before read-back...`);
await new Promise((r) => setTimeout(r, 6000));

const [bqRows] = await bq.query({
  query: `
    SELECT
      SUM(IF(metric_key='ad_spend' AND target_date >= '2026-05-17',     metric_value, NULL)) AS ad_spend_future,
      SUM(IF(metric_key='cash'     AND target_date >= '2026-05-17',     metric_value, NULL)) AS cash_future,
      SUM(IF(metric_key='ad_spend',     metric_value, NULL)) AS ad_spend_full_month,
      SUM(IF(metric_key='cash',         metric_value, NULL)) AS cash_full_month,
      SUM(IF(metric_key='revenue',      metric_value, NULL)) AS revenue_full_month,
      SUM(IF(metric_key='deals_closed', metric_value, NULL)) AS deals_closed_full_month,
      SUM(IF(metric_key='calls_booked', metric_value, NULL)) AS calls_booked_full_month,
      COUNT(*) AS row_count
    FROM ${FQ}
    WHERE forecast_id = @id AND metric_type = 'volume'
  `,
  params: { id: MAY_2026_FORECAST_ID },
  types: { id: "STRING" },
});
const bqRow = bqRows[0] ?? {};
console.log(`\n📊 BQ read-back:`);
console.log(`    row_count                = ${bqRow.row_count}`);
console.log(`    ad_spend  (5/17-31)      = $${Number(bqRow.ad_spend_future ?? 0).toLocaleString()}`);
console.log(`    cash      (5/17-31)      = $${Number(bqRow.cash_future ?? 0).toLocaleString()}`);
console.log(`    ad_spend  (full May)     = $${Number(bqRow.ad_spend_full_month ?? 0).toLocaleString()}`);
console.log(`    cash      (full May)     = $${Number(bqRow.cash_full_month ?? 0).toLocaleString()}`);
console.log(`    revenue   (full May)     = $${Number(bqRow.revenue_full_month ?? 0).toLocaleString()}`);
console.log(`    deals     (full May)     = ${Number(bqRow.deals_closed_full_month ?? 0).toFixed(1)}`);
console.log(`    booked    (full May)     = ${Number(bqRow.calls_booked_full_month ?? 0)}`);

const bqChecks: Check[] = [
  { label: "BQ ad_spend May 17-31",      expected:  37190, actual: Number(bqRow.ad_spend_future ?? 0) },
  { label: "BQ cash May 17-31",          expected: 133845, actual: Number(bqRow.cash_future ?? 0) },
  { label: "BQ ad_spend full May",       expected:  70856, actual: Number(bqRow.ad_spend_full_month ?? 0) },
  { label: "BQ cash full May",           expected: 242542, actual: Number(bqRow.cash_full_month ?? 0) },
  { label: "BQ revenue full May",        expected: 332081, actual: Number(bqRow.revenue_full_month ?? 0) },
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
