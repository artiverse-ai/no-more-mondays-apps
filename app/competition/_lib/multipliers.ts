// Special-day point multipliers for the competition.
//
// Read from an EXTERNAL BigQuery table backed by a Google Sheet — admins
// edit the sheet (one row per bonus day: date + multiplier), no deploy
// needed. Because the table is sheet-backed, the BigQuery client needs
// the Drive scope AND the sheet must be shared with the service account
// (shahriar-s-service-account@no-more-mondays-analytics.iam.gserviceaccount.com).
//
// Any failure here is swallowed → empty map → every day scores at 1×.
// A multiplier outage must never break the leaderboard.

import { BigQuery } from "@google-cloud/bigquery";

const TABLE =
  "`no-more-mondays-analytics.nmm_calendar.closer_setter_competition_point_multiplier`";

let _client: BigQuery | null = null;

/** BigQuery client with the Drive scope — needed to read the
 *  sheet-backed external multiplier table. */
function driveScopedBq(): BigQuery {
  if (_client) return _client;
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  _client = new BigQuery({
    projectId: "no-more-mondays-analytics",
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
    ...(credsJson ? { credentials: JSON.parse(credsJson) } : {}),
  });
  return _client;
}

/** Parse a date cell — accepts ISO (YYYY-MM-DD) and Google Sheets'
 *  default M/D/YYYY display. Returns null for the header row or
 *  anything unparseable, so those rows are simply skipped. */
function normalizeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

/** date (YYYY-MM-DD) → point multiplier. Empty when none configured or
 *  on any error — callers treat a missing date as 1×. */
export async function fetchPointMultipliers(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const [rows] = await driveScopedBq().query({
      query: `SELECT string_field_0 AS d, string_field_1 AS m FROM ${TABLE}`,
    });
    for (const r of rows as Array<{ d?: unknown; m?: unknown }>) {
      const date = normalizeDate(r.d);
      const mult = Number(r.m);
      if (date && Number.isFinite(mult) && mult > 0) map.set(date, mult);
    }
  } catch (e) {
    console.error(
      "[multipliers] read failed — defaulting all days to 1×:",
      (e as Error).message,
    );
  }
  return map;
}

/** Today's date in ET (YYYY-MM-DD) — the competition runs on ET dates. */
export function todayEt(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}
