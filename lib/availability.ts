import { bq, table } from "./bq";

export type Slot = {
  slot_start: string;
  slot_end: string;
  available_count: number;
  available_emails: string[];
};

export type BusyInterval = {
  host_email: string;
  start_time: string;
  end_time: string;
  duration_min: number;
  title: string;
  gcal_title: string | null;
  calendly_event_type: string | null;
  calendly_invitee_name: string | null;
  calendly_invitee_email: string | null;
  calendly_qa: string | null;
  is_calendly_booking: boolean;
  attendee_count: number | null;
  is_all_day: boolean;
};

type SlotRow = {
  slot_start: { value: string } | string;
  slot_end: { value: string } | string;
  available_count: number;
  available_emails: string[];
};

type IntervalRow = {
  host_email: string;
  start_time: { value: string } | string;
  end_time: { value: string } | string;
  duration_min: number;
  title: string | null;
  gcal_title: string | null;
  calendly_event_type: string | null;
  calendly_invitee_name: string | null;
  calendly_invitee_email: string | null;
  calendly_qa: string | null;
  is_calendly_booking: boolean;
  attendee_count: number | null;
  is_all_day: boolean;
};

const ts = (v: { value: string } | string): string =>
  typeof v === "string" ? v : v.value;

export type AvailabilityQuery = {
  /** ISO date in the working timezone, e.g. "2026-05-09" */
  date: string;
  /** target call duration in minutes */
  durationMin: number;
  /** slot grid step in minutes (e.g. 15 means start times every :00 :15 :30 :45) */
  stepMin?: number;
  /** working day window, in 24h hours in the working timezone */
  fromHour?: number;
  toHour?: number;
  /** working timezone (BigQuery time zone string) */
  tz?: string;
  /** optional: restrict to these emails. Empty/undefined = all teammates */
  emails?: string[];
};

const SQL_AVAILABILITY = `
WITH
  params AS (
    SELECT
      DATE(@date) AS target_date,
      @duration_min AS duration_min,
      @step_min AS step_min,
      @from_hour AS from_hour,
      @to_hour AS to_hour,
      @tz AS tz
  ),
  -- Build the slot grid. window_start = target_date at from_hour in tz.
  -- window_end = window_start + (to_hour - from_hour) hours. This handles
  -- to_hour = 24 cleanly (becomes next-day 00:00 in tz).
  slots AS (
    SELECT
      slot_start,
      TIMESTAMP_ADD(slot_start, INTERVAL p.duration_min MINUTE) AS slot_end
    FROM
      params p,
      UNNEST(
        GENERATE_TIMESTAMP_ARRAY(
          TIMESTAMP(DATETIME(p.target_date, TIME(p.from_hour, 0, 0)), p.tz),
          TIMESTAMP_SUB(
            TIMESTAMP_ADD(
              TIMESTAMP(DATETIME(p.target_date, TIME(p.from_hour, 0, 0)), p.tz),
              INTERVAL (p.to_hour - p.from_hour) HOUR
            ),
            INTERVAL p.duration_min MINUTE
          ),
          INTERVAL p.step_min MINUTE
        )
      ) AS slot_start
  ),
  members AS (
    SELECT email
    FROM ${table("team_members")}
    WHERE (IFNULL(ARRAY_LENGTH(@emails), 0) = 0 OR email IN UNNEST(@emails))
  ),
  candidates AS (
    SELECT m.email, s.slot_start, s.slot_end
    FROM members m CROSS JOIN slots s
  ),
  conflicts AS (
    SELECT DISTINCT c.email, c.slot_start
    FROM candidates c
    JOIN ${table("busy_intervals")} bi
      ON bi.host_email = c.email
     AND bi.start_time < c.slot_end
     AND bi.end_time   > c.slot_start
  ),
  available AS (
    SELECT c.email, c.slot_start, c.slot_end
    FROM candidates c
    LEFT JOIN conflicts cf
      ON cf.email = c.email AND cf.slot_start = c.slot_start
    WHERE cf.email IS NULL
  )
SELECT
  slot_start,
  slot_end,
  COUNT(*) AS available_count,
  ARRAY_AGG(email ORDER BY email) AS available_emails
FROM available
GROUP BY slot_start, slot_end
ORDER BY slot_start
`;

export async function getAvailability(q: AvailabilityQuery): Promise<Slot[]> {
  const [rows] = await bq().query({
    query: SQL_AVAILABILITY,
    params: {
      date: q.date,
      duration_min: q.durationMin,
      step_min: q.stepMin ?? 15,
      from_hour: q.fromHour ?? 9,
      to_hour: q.toHour ?? 18,
      tz: q.tz ?? "America/New_York",
      emails: q.emails ?? [],
    },
    types: {
      date: "STRING",
      duration_min: "INT64",
      step_min: "INT64",
      from_hour: "INT64",
      to_hour: "INT64",
      tz: "STRING",
      emails: ["STRING"],
    },
  });
  return (rows as SlotRow[]).map((r) => ({
    slot_start: ts(r.slot_start),
    slot_end: ts(r.slot_end),
    available_count: Number(r.available_count),
    available_emails: r.available_emails ?? [],
  }));
}

const SQL_INTERVALS_FOR_USER_DAY = `
SELECT
  host_email,
  start_time,
  end_time,
  duration_min,
  title,
  gcal_title,
  calendly_event_type,
  calendly_invitee_name,
  calendly_invitee_email,
  calendly_qa,
  is_calendly_booking,
  attendee_count,
  is_all_day
FROM ${table("busy_intervals")}
WHERE host_email = @email
  AND start_time < TIMESTAMP_ADD(TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz), INTERVAL 24 HOUR)
  AND end_time   > TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz)
ORDER BY start_time
`;

const SQL_INTERVALS_FOR_USER_WEEK = `
SELECT
  host_email,
  start_time,
  end_time,
  duration_min,
  title,
  gcal_title,
  calendly_event_type,
  calendly_invitee_name,
  calendly_invitee_email,
  calendly_qa,
  is_calendly_booking,
  attendee_count,
  is_all_day
FROM ${table("busy_intervals")}
WHERE host_email = @email
  AND start_time < TIMESTAMP_ADD(TIMESTAMP(DATETIME(DATE(@date_from), TIME '00:00:00'), @tz), INTERVAL @days_count DAY)
  AND end_time   > TIMESTAMP(DATETIME(DATE(@date_from), TIME '00:00:00'), @tz)
ORDER BY start_time
`;

export async function getIntervalsForUserWeek(args: {
  email: string;
  dateFrom: string;
  daysCount?: number;
  tz?: string;
}): Promise<BusyInterval[]> {
  const [rows] = await bq().query({
    query: SQL_INTERVALS_FOR_USER_WEEK,
    params: {
      email: args.email,
      date_from: args.dateFrom,
      days_count: args.daysCount ?? 7,
      tz: args.tz ?? "America/New_York",
    },
    types: { email: "STRING", date_from: "STRING", days_count: "INT64", tz: "STRING" },
  });
  return (rows as IntervalRow[]).map((r) => ({
    host_email: r.host_email,
    start_time: ts(r.start_time),
    end_time: ts(r.end_time),
    duration_min: Number(r.duration_min),
    title: r.title ?? "(no title)",
    gcal_title: r.gcal_title,
    calendly_event_type: r.calendly_event_type,
    calendly_invitee_name: r.calendly_invitee_name,
    calendly_invitee_email: r.calendly_invitee_email,
    calendly_qa: r.calendly_qa,
    is_calendly_booking: r.is_calendly_booking,
    attendee_count: r.attendee_count,
    is_all_day: r.is_all_day,
  }));
}

export async function getIntervalsForUserDay(args: {
  email: string;
  date: string;
  tz?: string;
}): Promise<BusyInterval[]> {
  const [rows] = await bq().query({
    query: SQL_INTERVALS_FOR_USER_DAY,
    params: {
      email: args.email,
      date: args.date,
      tz: args.tz ?? "America/New_York",
    },
    types: {
      email: "STRING",
      date: "STRING",
      tz: "STRING",
    },
  });
  return (rows as IntervalRow[]).map((r) => ({
    host_email: r.host_email,
    start_time: ts(r.start_time),
    end_time: ts(r.end_time),
    duration_min: Number(r.duration_min),
    title: r.title ?? "(no title)",
    gcal_title: r.gcal_title,
    calendly_event_type: r.calendly_event_type,
    calendly_invitee_name: r.calendly_invitee_name,
    calendly_invitee_email: r.calendly_invitee_email,
    calendly_qa: r.calendly_qa,
    is_calendly_booking: r.is_calendly_booking,
    attendee_count: r.attendee_count,
    is_all_day: r.is_all_day,
  }));
}

const SQL_INTERVALS_FOR_TEAM_DAY = `
SELECT
  host_email,
  start_time,
  end_time,
  duration_min,
  title,
  gcal_title,
  calendly_event_type,
  calendly_invitee_name,
  calendly_invitee_email,
  calendly_qa,
  is_calendly_booking,
  attendee_count,
  is_all_day
FROM ${table("busy_intervals")}
WHERE host_email IN (SELECT email FROM ${table("team_members")})
  AND start_time < TIMESTAMP_ADD(TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz), INTERVAL 24 HOUR)
  AND end_time   > TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz)
ORDER BY host_email, start_time
`;

export async function getIntervalsForTeamDay(args: {
  date: string;
  tz?: string;
}): Promise<BusyInterval[]> {
  const [rows] = await bq().query({
    query: SQL_INTERVALS_FOR_TEAM_DAY,
    params: { date: args.date, tz: args.tz ?? "America/New_York" },
    types: { date: "STRING", tz: "STRING" },
  });
  return (rows as IntervalRow[]).map((r) => ({
    host_email: r.host_email,
    start_time: ts(r.start_time),
    end_time: ts(r.end_time),
    duration_min: Number(r.duration_min),
    title: r.title ?? "(no title)",
    gcal_title: r.gcal_title,
    calendly_event_type: r.calendly_event_type,
    calendly_invitee_name: r.calendly_invitee_name,
    calendly_invitee_email: r.calendly_invitee_email,
    calendly_qa: r.calendly_qa,
    is_calendly_booking: r.is_calendly_booking,
    attendee_count: r.attendee_count,
    is_all_day: r.is_all_day,
  }));
}

// Weekly trend: for each of the next N days, the average number of free
// teammates per slot at the chosen duration. Reuses the same overlap logic
// as the single-day getAvailability.
const SQL_WEEKLY_AVAILABILITY = `
WITH
  params AS (
    SELECT
      DATE(@from_date) AS start_date,
      @days_count AS days_count,
      @duration_min AS duration_min,
      @step_min AS step_min,
      @tz AS tz
  ),
  days AS (
    SELECT DATE_ADD(p.start_date, INTERVAL offset DAY) AS d
    FROM params p, UNNEST(GENERATE_ARRAY(0, p.days_count - 1)) AS offset
  ),
  slots AS (
    SELECT
      d.d AS target_date,
      slot_start,
      TIMESTAMP_ADD(slot_start, INTERVAL p.duration_min MINUTE) AS slot_end
    FROM
      params p,
      days d,
      UNNEST(
        GENERATE_TIMESTAMP_ARRAY(
          TIMESTAMP(DATETIME(d.d, TIME '00:00:00'), p.tz),
          TIMESTAMP_SUB(
            TIMESTAMP_ADD(TIMESTAMP(DATETIME(d.d, TIME '00:00:00'), p.tz), INTERVAL 24 HOUR),
            INTERVAL p.duration_min MINUTE
          ),
          INTERVAL p.step_min MINUTE
        )
      ) AS slot_start
  ),
  members AS (
    SELECT email
    FROM ${table("team_members")}
    WHERE (IFNULL(ARRAY_LENGTH(@emails), 0) = 0 OR email IN UNNEST(@emails))
  ),
  candidates AS (
    SELECT m.email, s.target_date, s.slot_start, s.slot_end
    FROM members m CROSS JOIN slots s
  ),
  conflicts AS (
    SELECT DISTINCT c.email, c.target_date, c.slot_start
    FROM candidates c
    JOIN ${table("busy_intervals")} bi
      ON bi.host_email = c.email
     AND bi.start_time < c.slot_end
     AND bi.end_time   > c.slot_start
  ),
  per_slot AS (
    SELECT
      c.target_date,
      c.slot_start,
      COUNT(*) - SUM(CASE WHEN cf.email IS NULL THEN 0 ELSE 1 END) AS free_count
    FROM candidates c
    LEFT JOIN conflicts cf
      ON cf.email = c.email
     AND cf.slot_start = c.slot_start
     AND cf.target_date = c.target_date
    GROUP BY c.target_date, c.slot_start
  )
SELECT
  target_date,
  COUNT(*) AS slot_count,
  AVG(free_count) AS avg_free_per_slot,
  MAX(free_count) AS max_free,
  COUNTIF(free_count = 0) AS fully_booked
FROM per_slot
GROUP BY target_date
ORDER BY target_date
`;

export type DailyAvailability = {
  date: string;
  slot_count: number;
  avg_free_per_slot: number;
  max_free: number;
  fully_booked: number;
};

export async function getWeeklyAvailability(args: {
  fromDate: string;
  daysCount?: number;
  durationMin: number;
  stepMin?: number;
  tz?: string;
  emails?: string[];
}): Promise<DailyAvailability[]> {
  const [rows] = await bq().query({
    query: SQL_WEEKLY_AVAILABILITY,
    params: {
      from_date: args.fromDate,
      days_count: args.daysCount ?? 7,
      duration_min: args.durationMin,
      step_min: args.stepMin ?? 15,
      tz: args.tz ?? "America/New_York",
      emails: args.emails ?? [],
    },
    types: {
      from_date: "STRING",
      days_count: "INT64",
      duration_min: "INT64",
      step_min: "INT64",
      tz: "STRING",
      emails: ["STRING"],
    },
  });
  return (rows as Array<{
    target_date: { value: string } | string;
    slot_count: number | string;
    avg_free_per_slot: number | string;
    max_free: number | string;
    fully_booked: number | string;
  }>).map((r) => ({
    date: typeof r.target_date === "string" ? r.target_date : r.target_date.value,
    slot_count: Number(r.slot_count),
    avg_free_per_slot: Number(r.avg_free_per_slot),
    max_free: Number(r.max_free),
    fully_booked: Number(r.fully_booked),
  }));
}

// =====================================================================
// RANGE AVAILABILITY — across multiple days, fixed slot interval
// =====================================================================

const SQL_RANGE_SLOTS = `
WITH
  params AS (
    SELECT
      DATE(@from_date) AS d_from,
      DATE(@to_date)   AS d_to,
      @duration_min    AS duration_min,
      @interval_min    AS interval_min,
      @tz              AS tz
  ),
  days AS (
    SELECT d
    FROM params p, UNNEST(GENERATE_DATE_ARRAY(p.d_from, p.d_to)) AS d
  ),
  -- Per-day slots: starting at midnight in the given TZ, spaced by interval_min,
  -- such that slot_start + duration_min still fits in the day.
  slots AS (
    SELECT
      d.d AS slot_date,
      slot_start,
      TIMESTAMP_ADD(slot_start, INTERVAL p.duration_min MINUTE) AS slot_end
    FROM
      params p,
      days d,
      UNNEST(
        GENERATE_TIMESTAMP_ARRAY(
          TIMESTAMP(DATETIME(d.d, TIME '00:00:00'), p.tz),
          TIMESTAMP_SUB(
            TIMESTAMP_ADD(TIMESTAMP(DATETIME(d.d, TIME '00:00:00'), p.tz), INTERVAL 24 HOUR),
            INTERVAL p.duration_min MINUTE
          ),
          INTERVAL p.interval_min MINUTE
        )
      ) AS slot_start
  ),
  members AS (
    SELECT email
    FROM ${table("team_members")}
    WHERE (IFNULL(ARRAY_LENGTH(@emails), 0) = 0 OR email IN UNNEST(@emails))
  ),
  candidates AS (
    SELECT m.email, s.slot_date, s.slot_start, s.slot_end
    FROM members m CROSS JOIN slots s
  ),
  conflicts AS (
    SELECT DISTINCT c.email, c.slot_start
    FROM candidates c
    JOIN ${table("busy_intervals")} bi
      ON bi.host_email = c.email
     AND bi.start_time < c.slot_end
     AND bi.end_time   > c.slot_start
  ),
  available AS (
    SELECT c.email, c.slot_date, c.slot_start, c.slot_end
    FROM candidates c
    LEFT JOIN conflicts cf ON cf.email = c.email AND cf.slot_start = c.slot_start
    WHERE cf.email IS NULL
  )
SELECT
  slot_date,
  slot_start,
  slot_end,
  COUNT(*) AS available_count,
  ARRAY_AGG(email ORDER BY email) AS available_emails
FROM available
GROUP BY slot_date, slot_start, slot_end
ORDER BY slot_start
`;

export type RangeSlot = {
  slot_date: string;
  slot_start: string;
  slot_end: string;
  available_count: number;
  available_emails: string[];
};

type RangeSlotRow = {
  slot_date: { value: string } | string;
  slot_start: { value: string } | string;
  slot_end: { value: string } | string;
  available_count: number | string;
  available_emails: string[];
};

export async function getRangeSlots(args: {
  fromDate: string;
  toDate: string;
  durationMin?: number;
  intervalMin?: number;
  tz?: string;
  emails?: string[];
}): Promise<RangeSlot[]> {
  const [rows] = await bq().query({
    query: SQL_RANGE_SLOTS,
    params: {
      from_date: args.fromDate,
      to_date: args.toDate,
      duration_min: args.durationMin ?? 60,
      interval_min: args.intervalMin ?? 90,
      tz: args.tz ?? "America/New_York",
      emails: args.emails ?? [],
    },
    types: {
      from_date: "STRING",
      to_date: "STRING",
      duration_min: "INT64",
      interval_min: "INT64",
      tz: "STRING",
      emails: ["STRING"],
    },
  });
  return (rows as RangeSlotRow[]).map((r) => ({
    slot_date: typeof r.slot_date === "string" ? r.slot_date : r.slot_date.value,
    slot_start: ts(r.slot_start),
    slot_end: ts(r.slot_end),
    available_count: Number(r.available_count),
    available_emails: r.available_emails ?? [],
  }));
}

const SQL_TEAM_MEMBERS = `
SELECT email
FROM ${table("team_members")}
ORDER BY email
`;

export async function getTeamMembers(): Promise<string[]> {
  const [rows] = await bq().query({ query: SQL_TEAM_MEMBERS });
  return (rows as { email: string }[]).map((r) => r.email);
}

const SQL_CLOSER_TIMEZONE = `
SELECT time_zone
FROM ${table("calendar_timezones")}
WHERE LOWER(user_email) = LOWER(@email)
LIMIT 1
`;

export async function getCloserTimezone(email: string): Promise<string | null> {
  const [rows] = await bq().query({
    query: SQL_CLOSER_TIMEZONE,
    params: { email },
    types: { email: "STRING" },
  });
  const r = (rows as { time_zone: string }[])[0];
  return r?.time_zone ?? null;
}

// busy_min uses MERGED intervals (so an all-day event + a meeting inside
// it counts once, not twice). events counts the raw underlying entries.
const SQL_PERSON_DAY_STATS = `
WITH bounds AS (
  SELECT
    TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz) AS day_start,
    TIMESTAMP_ADD(TIMESTAMP(DATETIME(DATE(@date), TIME '00:00:00'), @tz), INTERVAL 24 HOUR) AS day_end
),
clipped AS (
  SELECT
    bi.host_email,
    GREATEST(bi.start_time, b.day_start) AS s,
    LEAST(bi.end_time, b.day_end) AS e
  FROM ${table("busy_intervals")} bi, bounds b
  WHERE bi.start_time < b.day_end AND bi.end_time > b.day_start
    AND bi.host_email IN (SELECT email FROM ${table("team_members")})
),
ordered AS (
  SELECT
    host_email, s, e,
    MAX(e) OVER (
      PARTITION BY host_email
      ORDER BY s
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_max_end
  FROM clipped
),
grouped AS (
  SELECT
    host_email, s, e,
    SUM(CASE WHEN prev_max_end IS NULL OR s > prev_max_end THEN 1 ELSE 0 END)
      OVER (PARTITION BY host_email ORDER BY s ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp
  FROM ordered
),
merged AS (
  SELECT host_email, MIN(s) AS gs, MAX(e) AS ge
  FROM grouped
  GROUP BY host_email, grp
),
busy AS (
  SELECT host_email, SUM(TIMESTAMP_DIFF(ge, gs, MINUTE)) AS busy_min
  FROM merged
  GROUP BY host_email
),
counts AS (
  SELECT host_email, COUNT(*) AS events
  FROM clipped
  GROUP BY host_email
)
SELECT
  m.email,
  COALESCE(b.busy_min, 0) AS busy_min,
  COALESCE(c.events, 0) AS events
FROM ${table("team_members")} m
LEFT JOIN busy b ON b.host_email = m.email
LEFT JOIN counts c ON c.host_email = m.email
ORDER BY busy_min DESC
`;

export type PersonDayStat = { email: string; busy_min: number; events: number };

export async function getPersonDayStats(args: {
  date: string;
  tz?: string;
}): Promise<PersonDayStat[]> {
  const [rows] = await bq().query({
    query: SQL_PERSON_DAY_STATS,
    params: { date: args.date, tz: args.tz ?? "America/New_York" },
    types: { date: "STRING", tz: "STRING" },
  });
  return (rows as Array<{ email: string; busy_min: number | string; events: number | string }>).map(
    (r) => ({
      email: r.email,
      busy_min: Number(r.busy_min),
      events: Number(r.events),
    })
  );
}

// =====================================================================
// CALENDAR HYGIENE — flag closers whose calendars look suspiciously empty
// =====================================================================

// Anyone busy < 25% of the visible range is flagged. A normal calendar with
// a nightly sleep block alone clears 33%; <25% almost always means the
// closer hasn't followed the calendar-management SOP.
export const LOW_COVERAGE_THRESHOLD = 0.25;

const SQL_HYGIENE = `
WITH params AS (
  SELECT
    TIMESTAMP(DATETIME(DATE(@from_date), TIME '00:00:00'), @tz) AS range_start,
    TIMESTAMP_ADD(TIMESTAMP(DATETIME(DATE(@to_date), TIME '00:00:00'), @tz), INTERVAL 24 HOUR) AS range_end
),
members AS (
  SELECT email FROM ${table("team_members")}
  WHERE (IFNULL(ARRAY_LENGTH(@emails), 0) = 0 OR email IN UNNEST(@emails))
),
clipped AS (
  SELECT
    bi.host_email,
    GREATEST(bi.start_time, p.range_start) AS s,
    LEAST(bi.end_time, p.range_end) AS e
  FROM ${table("busy_intervals")} bi, params p
  WHERE bi.host_email IN (SELECT email FROM members)
    AND bi.start_time < p.range_end
    AND bi.end_time > p.range_start
),
ordered AS (
  SELECT
    host_email, s, e,
    MAX(e) OVER (
      PARTITION BY host_email
      ORDER BY s
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prev_max_end
  FROM clipped
),
grouped AS (
  SELECT
    host_email, s, e,
    SUM(CASE WHEN prev_max_end IS NULL OR s > prev_max_end THEN 1 ELSE 0 END)
      OVER (PARTITION BY host_email ORDER BY s ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS grp
  FROM ordered
),
merged AS (
  SELECT host_email, MIN(s) AS gs, MAX(e) AS ge
  FROM grouped
  GROUP BY host_email, grp
),
busy AS (
  SELECT host_email, SUM(TIMESTAMP_DIFF(ge, gs, MINUTE)) AS busy_min
  FROM merged
  GROUP BY host_email
),
events AS (
  SELECT host_email, COUNT(*) AS events_count
  FROM clipped
  GROUP BY host_email
)
SELECT
  m.email,
  COALESCE(b.busy_min, 0) AS busy_min,
  COALESCE(ev.events_count, 0) AS events_count,
  TIMESTAMP_DIFF(
    (SELECT range_end FROM params),
    (SELECT range_start FROM params),
    MINUTE
  ) AS range_total_min
FROM members m
LEFT JOIN busy b ON b.host_email = m.email
LEFT JOIN events ev ON ev.host_email = m.email
ORDER BY busy_min ASC
`;

export type CloserHygiene = {
  email: string;
  busy_min: number;
  events_count: number;
  range_total_min: number;
  coverage_pct: number; // 0..1
  is_low_coverage: boolean;
};

export async function getCalendarHygiene(args: {
  fromDate: string;
  toDate: string;
  tz?: string;
  emails?: string[];
}): Promise<CloserHygiene[]> {
  const [rows] = await bq().query({
    query: SQL_HYGIENE,
    params: {
      from_date: args.fromDate,
      to_date: args.toDate,
      tz: args.tz ?? "America/New_York",
      emails: args.emails ?? [],
    },
    types: {
      from_date: "STRING",
      to_date: "STRING",
      tz: "STRING",
      emails: ["STRING"],
    },
  });
  return (rows as Array<{
    email: string;
    busy_min: number | string;
    events_count: number | string;
    range_total_min: number | string;
  }>).map((r) => {
    const busy_min = Number(r.busy_min);
    const range_total_min = Number(r.range_total_min);
    const coverage_pct =
      range_total_min > 0 ? busy_min / range_total_min : 0;
    return {
      email: r.email,
      busy_min,
      events_count: Number(r.events_count),
      range_total_min,
      coverage_pct,
      is_low_coverage: coverage_pct < LOW_COVERAGE_THRESHOLD,
    };
  });
}

const SQL_DATA_RANGE = `
SELECT
  MIN(start_time) AS min_ts,
  MAX(end_time) AS max_ts,
  COUNT(*) AS total_events
FROM ${table("busy_intervals")}
`;

export async function getDataRange(): Promise<{
  min_ts: string | null;
  max_ts: string | null;
  total_events: number;
}> {
  const [rows] = await bq().query({ query: SQL_DATA_RANGE });
  const r = (rows as Array<{
    min_ts: { value: string } | string | null;
    max_ts: { value: string } | string | null;
    total_events: number;
  }>)[0];
  return {
    min_ts: r.min_ts ? ts(r.min_ts as { value: string } | string) : null,
    max_ts: r.max_ts ? ts(r.max_ts as { value: string } | string) : null,
    total_events: Number(r.total_events),
  };
}
