// May 2026 forecast — converted from
// "NMM May 2026 Projection Model" (generated 2026-05-17).
//
// Structure:
//   - May 1-16: historical actuals are NOT seeded as targets (those days are
//     already done — for actual-vs-target framing the "target" for past days
//     is the projected daily run-rate at the time, which we don't have).
//   - May 17-31: per-event volumes for the 4 known webinars + per-day ad
//     spend + per-day setter cash distributed evenly. Rates are stored once
//     for the period.
//
// To re-seed: POST /api/admin/seed-forecast with { forecast_id: 'may-2026-v1' }.
// Forecast versioning = new forecast_id (e.g. 'may-2026-v2' for a revision).

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

// From "Future Webinars (May 17-31)" block in the CSV.
const FUTURE_EVENTS: EventProjection[] = [
  { date: "2026-05-17", channel: "webinar",  event_label: "FCW Sun",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
  { date: "2026-05-20", channel: "webinar",  event_label: "FCW Wed",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
  { date: "2026-05-24", channel: "workshop", event_label: "Monthly Workshop", booked: 200, held: 84.0, closed: 16.8, cash: 50719, revenue: 69485 },
  { date: "2026-05-27", channel: "webinar",  event_label: "FCW Wed",          booked:  35, held: 16.5, closed:  6.4, cash: 19442, revenue: 26630 },
  // 5/31 FCW Sun runs but calls held in June — explicitly excluded from May close.
];

// From "Ad Spend Distribution" block — total maps to $37,190.
const FUTURE_AD_SPEND: Array<{ date: string; total: number; event?: string }> = [
  { date: "2026-05-17", total: 2170, event: "FCW Sun" },
  { date: "2026-05-18", total: 2508, event: "WS Week" },
  { date: "2026-05-19", total: 2555, event: "WS Week" },
  { date: "2026-05-20", total: 2610, event: "FCW Wed + WS Week" },
  { date: "2026-05-21", total: 2677, event: "WS Week" },
  { date: "2026-05-22", total: 2677, event: "WS Week" },
  { date: "2026-05-23", total: 2677, event: "WS Week" },
  { date: "2026-05-24", total: 2677, event: "Monthly Workshop" },
  { date: "2026-05-25", total: 2377 },
  { date: "2026-05-26", total: 2377 },
  { date: "2026-05-27", total: 2377, event: "FCW Wed" },
  { date: "2026-05-28", total: 2377 },
  { date: "2026-05-29", total: 2377 },
  { date: "2026-05-30", total: 2377 },
  { date: "2026-05-31", total: 2377, event: "FCW Sun (June close)" },
];

// Setter funnel May 17-31 totals from "Channel Rollup" block — distributed
// evenly across 15 days since the CSV doesn't break them down per-day.
const SETTER_DAYS = 15;
const SETTER_TOTALS = {
  ad_spend: 8435,
  booked: 57,
  held: 25,
  closed: 8.3,
  cash: 24800,
  revenue: 33814,
};

// Period-constant rates from "Variables" block.
const PERIOD_RATES = [
  // Channel = 'webinar' (Weekly Webinar rates from CSV)
  { metric_key: "show_rate",  channel: "webinar",  value: 0.47, notes: "Weekly Webinar show rate — May MTD actual" },
  { metric_key: "close_rate", channel: "webinar",  value: 0.39, notes: "Weekly Webinar close rate — May MTD actual" },
  { metric_key: "aov_cash",   channel: "webinar",  value: 3019, notes: "Webinar AOV Cash — May MTD actual" },
  { metric_key: "acv",        channel: "webinar",  value: 4136, notes: "Webinar ACV — May MTD actual" },
  // Channel = 'workshop'
  { metric_key: "show_rate",  channel: "workshop", value: 0.42, notes: "Workshop show rate — Apr 38% + May MTD 47%" },
  { metric_key: "close_rate", channel: "workshop", value: 0.20, notes: "Workshop close rate — Apr monthly workshop reality" },
  // Channel = 'setter'
  { metric_key: "show_rate",  channel: "setter",   value: 0.44, notes: "Setter show rate — May MTD actual" },
  { metric_key: "close_rate", channel: "setter",   value: 0.33, notes: "Setter close rate — May MTD actual" },
  { metric_key: "aov_cash",   channel: "setter",   value: 2988, notes: "Setter AOV Cash — May MTD actual" },
  { metric_key: "acv",        channel: "setter",   value: 4074, notes: "Setter ACV — May MTD actual" },
  // Channel = 'all' — blended rates the dashboards use by default.
  // Blend computed as deals-weighted average across webinar+workshop+setter
  // for May 17-31 projection: 30 webinar deals + 16.8 workshop + 8.3 setter
  // = 55.1 closed / 305+57 booked × (47% × 305 + 42% × 200... ) — too noisy.
  // Use the simpler model totals from "Full Month": 80 deals / projected
  // calls and projected shows.
  { metric_key: "show_rate",  channel: "all", value: 0.44, notes: "Blended show rate — derived from projected funnel" },
  { metric_key: "close_rate", channel: "all", value: 0.28, notes: "Blended close rate — 80 deals / ~285 projected qualified shows" },
  { metric_key: "aov_cash",   channel: "all", value: 3032, notes: "Blended AOV — $242K cash / 80 deals" },
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

  // Per-event volumes
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

  // Per-day ad spend
  for (const day of FUTURE_AD_SPEND) {
    rows.push({
      ...base,
      target_date: day.date,
      channel: "all",
      event_label: day.event ?? null,
      metric_key: "ad_spend",
      metric_type: "volume",
      metric_value: day.total,
      notes: null,
    });
  }

  // Setter daily distribution (May 17-31)
  for (let i = 0; i < SETTER_DAYS; i++) {
    const d = new Date(Date.UTC(2026, 4, 17 + i));
    const iso = d.toISOString().slice(0, 10);
    const evBase = {
      ...base,
      target_date: iso,
      channel: "setter" as const,
      event_label: null,
      metric_type: "volume" as const,
      notes: "Evenly distributed across May 17-31 from channel rollup totals",
    };
    rows.push({ ...evBase, metric_key: "ad_spend",     metric_value: SETTER_TOTALS.ad_spend / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "calls_booked", metric_value: SETTER_TOTALS.booked / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "calls_held",   metric_value: SETTER_TOTALS.held / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "deals_closed", metric_value: SETTER_TOTALS.closed / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "cash",         metric_value: SETTER_TOTALS.cash / SETTER_DAYS });
    rows.push({ ...evBase, metric_key: "revenue",      metric_value: SETTER_TOTALS.revenue / SETTER_DAYS });
  }

  // Period-constant rates
  for (const rate of PERIOD_RATES) {
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
