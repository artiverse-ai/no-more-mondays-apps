// Debug: run getForecastBundleForWindow exactly as the UI does it.
// If this returns nulls, the UI gets nulls and no chips render.
//
//   GOOGLE_APPLICATION_CREDENTIALS=...adc.json npx tsx scripts/debug-forecast-bundle.ts 2026-05-10 2026-05-16

import { getForecastBundleForWindow } from "../lib/forecast";

const [, , start, end] = process.argv;
if (!start || !end) {
  console.error("Usage: npx tsx scripts/debug-forecast-bundle.ts YYYY-MM-DD YYYY-MM-DD");
  process.exit(2);
}

async function main() {
  console.log(`\n→ getForecastBundleForWindow('${start}', '${end}')`);
  const bundle = await getForecastBundleForWindow(start, end);
  console.log("\nResult:");
  console.log(JSON.stringify(bundle, null, 2));

  if (bundle.forecastId == null) {
    console.log("\n❌ forecastId is null — pickForecastId() returned null. No forecast covers this window.");
  } else if (bundle.calls_booked == null) {
    console.log("\n❌ calls_booked is null — bundle SQL returned no rows. Targets won't render.");
  } else {
    console.log(`\n✅ Bundle non-null. Chips SHOULD render in the UI for this window.`);
  }
}

main().catch((err) => {
  console.error("\n❌ Bundle query crashed:", err);
  process.exit(1);
});
