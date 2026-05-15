// Determines which weekly-report snapshot is due next and whether the
// underlying BQ data is ready for it. Consumed by /api/weekly-reports/next.
//
// Cadence:
// - Monday → weekly_recap covering the prior Sun-Sat
// - Thursday → midweek_check covering the current week's Sun-Wed
// - Any other weekday → propose the most recent Mon/Thu on or before today
//   (so on Friday the proposal is still that Thursday's report, etc.)

import { bq } from "./bq";
import { getSnapshot, type ReportType } from "./weekly-report-snapshots";

// Marts live in dbt_tuddin, not the nmm_calendar dataset the table() helper
// targets. Inline the qualified names so we don't have to bend the helper.
const BQ_PROJECT = process.env.BQ_PROJECT || "no-more-mondays-analytics";
const MART = `\`${BQ_PROJECT}.dbt_tuddin.mart_webinar_events\``;
const ENRICHED = `\`${BQ_PROJECT}.dbt_tuddin.int_calls_enriched\``;

export type ProposedSnapshot = {
  slug: string;
  runOn: string;
  weekStart: string;
  weekEnd: string;
  reportType: ReportType;
  weekLabel: string;
  badge: string;
  latestWebinar: string;
};

export type Availability = {
  webinars: number;
  calls: number;
  missing: ("webinars" | "calls")[];
};

export type NextSnapshotResult =
  | { status: "exists"; proposed: ProposedSnapshot; existingSlug: string }
  | { status: "ready"; proposed: ProposedSnapshot; availability: Availability }
  | { status: "missing_data"; proposed: ProposedSnapshot; availability: Availability };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function fmtRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const s = start.toLocaleDateString("en-US", opts);
  const e = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${s}–${e}`;
}

function fmtBadgeDate(d: Date): string {
  // "MON MAY 18, 2026"
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    timeZone: "UTC",
  }).toUpperCase().replace(",", "");
}

function fmtThuMidweekLabel(start: Date, end: Date): string {
  // "Sun May 17 – Wed May 20, 2026 (week-to-date)"
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" };
  const s = start.toLocaleDateString("en-US", opts);
  const e = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${s} – ${e} (week-to-date)`;
}

function fmtLatestWebinar(d: Date, mode: ReportType): string {
  // "Sun May 10" for Monday (latest_sun); "Wed May 13" for Thursday (latest_wed).
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" };
  const formatted = d.toLocaleDateString("en-US", opts);
  return formatted;
}

/**
 * For a given "today" (UTC date), find the most recent Mon or Thu (inclusive)
 * and build the proposed snapshot.
 */
export function proposeFromDate(now: Date): ProposedSnapshot {
  // Walk back to most recent Mon (1) or Thu (4) in UTC weekday space.
  // JS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  let runDate = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  ));
  while (runDate.getUTCDay() !== 1 && runDate.getUTCDay() !== 4) {
    runDate = addDays(runDate, -1);
  }
  const isMonday = runDate.getUTCDay() === 1;
  const reportType: ReportType = isMonday ? "weekly_recap" : "midweek_check";

  let weekStart: Date;
  let weekEnd: Date;
  let weekLabel: string;
  let badge: string;

  if (isMonday) {
    // Sun-Sat of the prior week. Monday May 18 covers Sun May 10 - Sat May 16.
    weekStart = addDays(runDate, -8);
    weekEnd = addDays(runDate, -2);
    weekLabel = `Week ${fmtRange(weekStart, weekEnd)}, ${weekEnd.getUTCFullYear()}`;
    badge = fmtBadgeDate(runDate);
  } else {
    // Sun-Wed of current week. Thursday May 14 covers Sun May 10 - Wed May 13.
    weekStart = addDays(runDate, -4);
    weekEnd = addDays(runDate, -1);
    weekLabel = fmtThuMidweekLabel(weekStart, weekEnd);
    badge = `${fmtBadgeDate(runDate)} · MIDWEEK`;
  }

  // Monday recap: latest webinar is the Sunday the day before run (Sun).
  // Thursday midweek: latest webinar is the Wednesday the day before run (Wed).
  // Both are the day before runDate.
  const latestWebinarDay = addDays(runDate, -1);
  const latestWebinar = fmtLatestWebinar(latestWebinarDay, reportType);

  return {
    slug: isoDate(runDate),
    runOn: isoDate(runDate),
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(weekEnd),
    reportType,
    weekLabel,
    badge,
    latestWebinar,
  };
}

/**
 * Confirm we have webinar + call data for the proposed week. Returns counts
 * for each and a list of whichever is empty.
 */
export async function checkAvailability(weekStart: string, weekEnd: string): Promise<Availability> {
  const [rows] = await bq().query({
    query: `SELECT
        (SELECT COUNT(*) FROM ${MART}
           WHERE webinar_date BETWEEN DATE(@start) AND DATE(@end)) AS webinars,
        (SELECT COUNT(*) FROM ${ENRICHED}
           WHERE DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)) AS calls`,
    params: { start: weekStart, end: weekEnd },
    types: { start: "STRING", end: "STRING" },
  });
  const r = (rows as Array<{ webinars: number | string; calls: number | string }>)[0] ?? { webinars: 0, calls: 0 };
  const webinars = Number(r.webinars ?? 0);
  const calls = Number(r.calls ?? 0);
  const missing: Availability["missing"] = [];
  if (webinars === 0) missing.push("webinars");
  if (calls === 0) missing.push("calls");
  return { webinars, calls, missing };
}

/**
 * Build a proposed snapshot from a specific Mon/Thu run date. Throws if the
 * given date is not a Monday or Thursday, or if it is in the future.
 */
export function proposeFromRunDate(runDate: Date, now: Date = new Date()): ProposedSnapshot {
  const day = runDate.getUTCDay();
  if (day !== 1 && day !== 4) {
    throw new Error(`Run date ${isoDate(runDate)} is not a Monday or Thursday`);
  }
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (runDate > todayUtc) {
    throw new Error(`Run date ${isoDate(runDate)} is in the future`);
  }
  return proposeFromDate(runDate);
}

/**
 * Enumerate every Mon + Thu from `weeksBack` weeks ago up to and including
 * the most-recent Mon/Thu on or before `now`. Newest-first.
 */
export function enumerateMonThuRange(now: Date = new Date(), weeksBack = 12): ProposedSnapshot[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cutoff = addDays(today, -weeksBack * 7);

  // Walk back from today to the most recent Mon/Thu.
  let cursor = today;
  while (cursor.getUTCDay() !== 1 && cursor.getUTCDay() !== 4) {
    cursor = addDays(cursor, -1);
  }
  const out: ProposedSnapshot[] = [];
  while (cursor >= cutoff) {
    out.push(proposeFromDate(cursor));
    // Step back to the previous Mon or Thu. Mon (1) → prev Thu = -4 days;
    // Thu (4) → prev Mon = -3 days.
    cursor = addDays(cursor, cursor.getUTCDay() === 1 ? -4 : -3);
  }
  return out;
}

/**
 * One-shot helper used by the API route.
 */
export async function determineNext(now: Date = new Date()): Promise<NextSnapshotResult> {
  const proposed = proposeFromDate(now);
  const existing = await getSnapshot(proposed.slug);
  if (existing) {
    return { status: "exists", proposed, existingSlug: existing.slug };
  }
  const availability = await checkAvailability(proposed.weekStart, proposed.weekEnd);
  if (availability.missing.length > 0) {
    return { status: "missing_data", proposed, availability };
  }
  return { status: "ready", proposed, availability };
}
