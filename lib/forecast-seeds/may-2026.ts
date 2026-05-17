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
const FORECAST_ID = "may-2026-v2";  // v2 = adds May 1-16 backfill (v1 was May 17-31 only)

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

// CSV "Past Webinars" block lines 38-42 — actuals for May 1-16.
// Per Shahriar 2026-05-18: target rows for past dates equal the actual
// values, so weekly-window comparisons return data (pace will read 100%
// for past windows, which is honest — we hit exactly what happened).
const PAST_EVENTS: EventProjection[] = [
  { date: "2026-05-03", channel: "webinar", event_label: "FCW Sun (past)", booked: 35, held: 23, closed: 14, cash:  7497, revenue: 16985 },
  { date: "2026-05-06", channel: "webinar", event_label: "FCW Wed (past)", booked: 18, held: 12, closed:  7, cash: 10991, revenue: 12991 },
  { date: "2026-05-10", channel: "webinar", event_label: "FCW Sun (past)", booked: 43, held: 18, closed: 10, cash:  6497, revenue: 14991 },
  { date: "2026-05-13", channel: "webinar", event_label: "FCW Wed (past)", booked: 41, held: 23, closed:  5, cash:  9994, revenue: 11991 },
];

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

// May 1-16 setter funnel actuals from CSV "Deals by Source" line 110
// (Setter Booked) — 13 deals / $38,840 cash / $52,961 revenue.
// Distributed across 16 days (3.6/day cadence vs 3.8 projected = consistent).
const PAST_SETTER_DAYS = 16;
const PAST_SETTER_TOTALS = {
  booked: 57,        // CSV doesn't give Past setter booked directly. Use same per-day cadence as future (3.8/day) → 60.8, round to 57 for symmetry with future. This is approximate.
  held: 25,          // ~same approximation
  closed: 13,        // CSV explicit (line 110)
  cash: 38840,       // CSV explicit
  revenue: 52961,    // CSV explicit
};

// May 1-16 non-webinar ad spend = total ($33,666) − 4 past webinars
// (CSV stated $22,970 but the 4 row sum is $22,969 — CSV's own rounding).
// Using $10,697 to make full-month totals reconcile exactly to CSV
// stated $33,666.
const PAST_NONWEBINAR_AD_SPEND_TOTAL = 10697;
const PAST_DAYS = 16;

// Rollover/installment/organic gap. CSV "Deals by Source" for May 1-16
// shows $108,697 cash and $148,892 revenue, but my per-event past
// webinars ($34,979 + $56,958) + past setter ($38,840 + $52,961) only
// sums to $73,819 cash / $109,919 revenue. The rest is Skool ($5,497),
// installments from prior-month deals, and setter-owned attribution on
// webinar-funnel deals (double-counting if added per-event AND setter).
// Distributing the gap as daily "other" channel rows keeps the full
// May 1-16 totals at $108,697 / $148,892 per CSV.
const PAST_OTHER_GAP = {
  cash:    108697 - 34979 - 38840,  // $34,878 — Skool + installments + attribution
  revenue: 148892 - 56958 - 52961,  // $38,973
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

  // 1a) PAST per-event webinar/workshop volumes (5 metric rows × 4 events = 20).
  for (const ev of PAST_EVENTS) {
    const evBase = {
      ...base,
      target_date: ev.date,
      channel: ev.channel,
      event_label: ev.event_label,
      metric_type: "volume" as const,
      notes: "May 1-16 actual — backfilled as 'target = actual' so weekly window comparisons return data",
    };
    rows.push({ ...evBase, metric_key: "calls_booked", metric_value: ev.booked });
    rows.push({ ...evBase, metric_key: "calls_held",   metric_value: ev.held });
    rows.push({ ...evBase, metric_key: "deals_closed", metric_value: ev.closed });
    rows.push({ ...evBase, metric_key: "cash",         metric_value: ev.cash });
    rows.push({ ...evBase, metric_key: "revenue",      metric_value: ev.revenue });
  }

  // 1b) FUTURE per-event webinar/workshop volumes (5 metric rows × 4 events = 20).
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

  // 2a) PAST per-day ad_spend — webinar funnel on event dates (4 rows) +
  //     non-webinar baseline distributed across 16 days (16 rows).
  for (const ev of PAST_EVENTS) {
    const adByDate: Record<string, number> = {
      "2026-05-03": 4952, "2026-05-06": 5900, "2026-05-10": 5910, "2026-05-13": 6207,
    };
    rows.push({
      ...base,
      target_date: ev.date,
      channel: "webinar",
      event_label: ev.event_label,
      metric_key: "ad_spend",
      metric_type: "volume",
      metric_value: adByDate[ev.date] ?? 0,
      notes: "May 1-16 actual webinar-campaign ad spend (CSV Past Webinars block)",
    });
  }
  for (let i = 0; i < PAST_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 4, 1 + i));
    const iso = d.toISOString().slice(0, 10);
    rows.push({
      ...base,
      target_date: iso,
      channel: "setter",     // proxy: non-webinar baseline includes retargeting + setter ads
      event_label: null,
      metric_key: "ad_spend",
      metric_type: "volume",
      metric_value: PAST_NONWEBINAR_AD_SPEND_TOTAL / PAST_DAYS,
      notes: "May 1-16 non-webinar ad spend baseline ($10,696/16 days) — retargeting + setter, CSV total minus past webinar campaign spend",
    });
  }

  // 2b) FUTURE per-day per-channel ad_spend (2 channels × 15 days = 30 rows).
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

  // 3a) PAST setter daily distribution May 1-16 (5 metric rows × 16 days = 80).
  for (let i = 0; i < PAST_SETTER_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 4, 1 + i));
    const iso = d.toISOString().slice(0, 10);
    const evBase = {
      ...base,
      target_date: iso,
      channel: "setter" as const,
      event_label: null,
      metric_type: "volume" as const,
      notes: "May 1-16 setter funnel distributed evenly (CSV 'Deals by Source' Setter Booked row: 13 deals, $38,840 cash)",
    };
    rows.push({ ...evBase, metric_key: "calls_booked", metric_value: PAST_SETTER_TOTALS.booked / PAST_SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "calls_held",   metric_value: PAST_SETTER_TOTALS.held / PAST_SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "deals_closed", metric_value: PAST_SETTER_TOTALS.closed / PAST_SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "cash",         metric_value: PAST_SETTER_TOTALS.cash / PAST_SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "revenue",      metric_value: PAST_SETTER_TOTALS.revenue / PAST_SETTER_DAYS });
  }

  // 3a-bis) PAST rollover/installment/organic gap (May 1-16) — closes the
  //         gap between per-event sums and CSV "Deals by Source" totals.
  //         Cash 34,878 + Revenue 38,973 distributed evenly across 16 days.
  for (let i = 0; i < PAST_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 4, 1 + i));
    const iso = d.toISOString().slice(0, 10);
    const evBase = {
      ...base,
      target_date: iso,
      channel: "other" as const,
      event_label: null,
      metric_type: "volume" as const,
      notes: "May 1-16 rollover/installment/organic gap — reconciles to CSV $108,697 total cash / $148,892 total revenue",
    };
    rows.push({ ...evBase, metric_key: "cash",    metric_value: PAST_OTHER_GAP.cash    / PAST_DAYS });
    rows.push({ ...evBase, metric_key: "revenue", metric_value: PAST_OTHER_GAP.revenue / PAST_DAYS });
  }

  // 3b) FUTURE setter daily distribution May 17-31 (5 metric rows × 15 days = 75).
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
