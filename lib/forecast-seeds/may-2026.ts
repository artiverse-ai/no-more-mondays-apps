// May 2026 forecast — converted from
// "NMM May 2026 Projection Model" (generated 2026-05-17).
//
// Every number traces directly to a CSV cell — no fabrications. Per-channel
// daily ad spend reconstructed exactly from the CSV's campaign breakdown
// (Webinar Campaigns + Hammer Baseline + Hammer Workshop Extra = webinar
// funnel; IG Profile + ManyChat = setter funnel).
//
// Coverage: May 17-31 only (the CSV's "Projected" half). May 1-16 actuals
// are real history, not targets — windows fully in the past show no target
// chip; windows that straddle May 17 only target the forward days.
//
// Verified totals (run scripts/verify-may-2026-forecast.mjs to re-check):
//   Webinar ad spend ........ $28,755    (CSV channel rollup ✓)
//   Setter ad spend .........  $8,435    (CSV channel rollup ✓)
//   Total ad spend ..........  $37,190   (CSV total ✓)
//   Webinar/workshop booked .  305       (CSV total counted ✓)
//   Setter booked ...........  57        (CSV channel rollup ✓)
//   Webinar/workshop cash ... $109,045   (CSV total counted ✓)
//   Setter cash ............. $24,800    (CSV channel rollup ✓)
//   Total cash .............. $133,845   (CSV May 17-31 projected ✓)
//
// To re-seed: POST /api/admin/seed-forecast or run
// scripts/seed-may-2026-forecast.mjs locally.

import type { ForecastTargetRow } from "../forecast-targets-table";

const PERIOD_START = "2026-05-01";
const PERIOD_END = "2026-05-31";
const FORECAST_ID = "may-2026-v1";

type EventProjection = {
  date: string;
  channel: "webinar" | "workshop";
  event_label: string;
  booked: number;
  held: number;
  closed: number;
  cash: number;
  revenue: number;
};

// CSV "Future Webinars" block lines 47-50.
// 5/31 FCW Sun runs but calls held in June → explicitly excluded.
const FUTURE_EVENTS: EventProjection[] = [
  { date: "2026-05-17", channel: "webinar",  event_label: "FCW Sun",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
  { date: "2026-05-20", channel: "webinar",  event_label: "FCW Wed",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
  { date: "2026-05-24", channel: "workshop", event_label: "Monthly Workshop", booked: 200, held: 84.0, closed: 16.8, cash: 50719, revenue: 69485 },
  { date: "2026-05-27", channel: "webinar",  event_label: "FCW Wed",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
];

// CSV "Ad Spend Distribution" block lines 57-72. Split per-channel exactly:
//   Webinar funnel = Webinar Campaigns + Hammer Baseline + Hammer Workshop Extra
//   Setter funnel  = IG Profile + ManyChat
type DailyAdSpend = {
  date: string;
  webinar: number;   // webinar funnel portion
  setter: number;    // setter funnel portion
  event?: string;
};
const FUTURE_AD_SPEND: DailyAdSpend[] = [
  { date: "2026-05-17", webinar: 1611 + 166 +   0, setter: 200 + 193, event: "FCW Sun" },              // 1777 + 393 = 2170
  { date: "2026-05-18", webinar: 1611 + 166 + 300, setter: 200 + 231, event: "WS Week" },              // 2077 + 431 = 2508
  { date: "2026-05-19", webinar: 1611 + 166 + 300, setter: 200 + 278, event: "WS Week" },              // 2077 + 478 = 2555
  { date: "2026-05-20", webinar: 1611 + 166 + 300, setter: 200 + 333, event: "FCW Wed + WS Week" },    // 2077 + 533 = 2610
  { date: "2026-05-21", webinar: 1611 + 166 + 300, setter: 200 + 400, event: "WS Week (MC at target)" },// 2077 + 600 = 2677
  { date: "2026-05-22", webinar: 1611 + 166 + 300, setter: 200 + 400, event: "WS Week" },              // 2077 + 600 = 2677
  { date: "2026-05-23", webinar: 1611 + 166 + 300, setter: 200 + 400, event: "WS Week" },              // 2077 + 600 = 2677
  { date: "2026-05-24", webinar: 1611 + 166 + 300, setter: 200 + 400, event: "Monthly Workshop" },     // 2077 + 600 = 2677
  { date: "2026-05-25", webinar: 1611 + 166 +   0, setter: 200 + 400 },                                // 1777 + 600 = 2377
  { date: "2026-05-26", webinar: 1611 + 166 +   0, setter: 200 + 400 },                                // 1777 + 600 = 2377
  { date: "2026-05-27", webinar: 1611 + 166 +   0, setter: 200 + 400, event: "FCW Wed" },              // 1777 + 600 = 2377
  { date: "2026-05-28", webinar: 1611 + 166 +   0, setter: 200 + 400 },                                // 1777 + 600 = 2377
  { date: "2026-05-29", webinar: 1611 + 166 +   0, setter: 200 + 400 },                                // 1777 + 600 = 2377
  { date: "2026-05-30", webinar: 1611 + 166 +   0, setter: 200 + 400 },                                // 1777 + 600 = 2377
  { date: "2026-05-31", webinar: 1611 + 166 +   0, setter: 200 + 400, event: "FCW Sun (June close)" }, // 1777 + 600 = 2377
];

// Setter funnel May 17-31 totals from "Channel Rollup" block line 78.
// CSV gives totals only — distributed evenly across 15 days since per-day
// breakdown is not in the source (setter cadence is "3.8 booked calls/day"
// per the variables block line 29, which matches 57/15 ≈ 3.8).
const SETTER_DAYS = 15;
const SETTER_TOTALS = {
  booked: 57,
  held: 25,
  closed: 8.3,
  cash: 24800,
  revenue: 33814,
};

// Per-channel rate constants from "Variables" block lines 22-33.
// Kept as REFERENCE rows only — TopMetrics derives blended rates at query
// time from volume sums (see lib/forecast.ts:getForecastBundleForWindow) so
// the target denominator stays in lock-step with the actuals denominator.
const RATE_CONSTANTS = [
  { metric_key: "show_rate",  channel: "webinar",  value: 0.47, notes: "Weekly Webinar show rate — May MTD actual (CSV line 25)" },
  { metric_key: "close_rate", channel: "webinar",  value: 0.39, notes: "Weekly Webinar close rate (deals/held) — May MTD actual (CSV line 26)" },
  { metric_key: "aov_cash",   channel: "webinar",  value: 3019, notes: "Webinar AOV Cash — May MTD actual (CSV line 30)" },
  { metric_key: "acv",        channel: "webinar",  value: 4136, notes: "Webinar ACV — May MTD actual (CSV line 31)" },
  { metric_key: "show_rate",  channel: "workshop", value: 0.42, notes: "Workshop show rate — Apr 38% + May MTD 47% split (CSV line 23)" },
  { metric_key: "close_rate", channel: "workshop", value: 0.20, notes: "Workshop close rate — April monthly workshop reality (CSV line 24)" },
  { metric_key: "show_rate",  channel: "setter",   value: 0.44, notes: "Setter show rate — May MTD actual (CSV line 27)" },
  { metric_key: "close_rate", channel: "setter",   value: 0.33, notes: "Setter close rate (deals/held) — May MTD actual (CSV line 28)" },
  { metric_key: "aov_cash",   channel: "setter",   value: 2988, notes: "Setter AOV Cash — May MTD actual (CSV line 32)" },
  { metric_key: "acv",        channel: "setter",   value: 4074, notes: "Setter ACV — May MTD actual (CSV line 33)" },
];

export const MAY_2026_FORECAST_ID = FORECAST_ID;

/** Build all rows for the May 2026 forecast in canonical shape. */
export function buildMay2026Rows(createdBy: string): ForecastTargetRow[] {
  const rows: ForecastTargetRow[] = [];
  const base = {
    forecast_id: FORECAST_ID,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    created_by: createdBy,
  };

  // 1) Per-event webinar/workshop volumes (5 metric rows × 4 events = 20).
  for (const ev of FUTURE_EVENTS) {
    const evBase = {
      ...base,
      target_date: ev.date,
      channel: ev.channel,
      event_label: ev.event_label,
      metric_type: "volume" as const,
      notes: null,
    };
    rows.push({ ...evBase, metric_key: "calls_booked", metric_value: ev.booked });
    rows.push({ ...evBase, metric_key: "calls_held",   metric_value: ev.held });
    rows.push({ ...evBase, metric_key: "deals_closed", metric_value: ev.closed });
    rows.push({ ...evBase, metric_key: "cash",         metric_value: ev.cash });
    rows.push({ ...evBase, metric_key: "revenue",      metric_value: ev.revenue });
  }

  // 2) Per-day per-channel ad_spend (2 channels × 15 days = 30 rows).
  for (const day of FUTURE_AD_SPEND) {
    const dayBase = {
      ...base,
      target_date: day.date,
      event_label: day.event ?? null,
      metric_key: "ad_spend",
      metric_type: "volume" as const,
      notes: null,
    };
    rows.push({ ...dayBase, channel: "webinar", metric_value: day.webinar });
    rows.push({ ...dayBase, channel: "setter",  metric_value: day.setter });
  }

  // 3) Setter daily distribution May 17-31 (5 metric rows × 15 days = 75).
  for (let i = 0; i < SETTER_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 4, 17 + i));
    const iso = d.toISOString().slice(0, 10);
    const evBase = {
      ...base,
      target_date: iso,
      channel: "setter" as const,
      event_label: null,
      metric_type: "volume" as const,
      notes: "Evenly distributed from setter channel rollup totals — CSV variables row says ~3.8 booked/day",
    };
    rows.push({ ...evBase, metric_key: "calls_booked", metric_value: SETTER_TOTALS.booked / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "calls_held",   metric_value: SETTER_TOTALS.held / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "deals_closed", metric_value: SETTER_TOTALS.closed / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "cash",         metric_value: SETTER_TOTALS.cash / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "revenue",      metric_value: SETTER_TOTALS.revenue / SETTER_DAYS });
  }

  // 4) Per-channel rate constants (10 reference rows). Not consumed by
  //    TopMetrics — bundle query derives blended rates from volume sums.
  for (const rate of RATE_CONSTANTS) {
    rows.push({
      ...base,
      target_date: null,
      channel: rate.channel,
      event_label: null,
      metric_key: rate.metric_key,
      metric_type: "rate",
      metric_value: rate.value,
      notes: rate.notes,
    });
  }

  return rows;
}
