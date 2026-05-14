// Date-range resolution for the Sales / Setter dashboards.
//
// Sundays-anchored weeks (matches WEEK(SUNDAY), booking_week_sun and the
// Looker convention). All "today"-relative buttons resolve in
// America/New_York time so the day rolls over on NY local midnight.
//
// Used by <DateRangePicker> on /dashboards/sales and /dashboards/setter.
// The CEO dashboard keeps its own simpler PeriodFilter for now.

export type DateRangeKey =
  | "this-week"
  | "prev-week"
  | "this-month"
  | "last-month"
  | "last-7d"
  | "last-30d"
  | "last-90d"
  | "ytd"
  | "custom";

export type ResolvedDateRange = {
  period: DateRangeKey;
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  label: string; // human readable, e.g. "This week", "Custom"
};

export type DateRangeOption = { key: DateRangeKey; label: string };

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { key: "this-week", label: "This week" },
  { key: "prev-week", label: "Previous week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-7d", label: "Last 7 days" },
  { key: "last-30d", label: "Last 30 days" },
  { key: "last-90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
  { key: "custom", label: "Custom" },
];

const LABELS: Record<DateRangeKey, string> = DATE_RANGE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.key]: o.label }),
  {} as Record<DateRangeKey, string>,
);

export function isDateRangeKey(v: string): v is DateRangeKey {
  return v in LABELS;
}

// ---------------------------------------------------------------------
// Date helpers (UTC math, Sunday-start weeks, NY-local "today")
// ---------------------------------------------------------------------

/** Current day in America/New_York as YYYY-MM-DD. */
export function todayInNY(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Sunday-anchored start of week for `iso`. (Sunday → iso unchanged.) */
function sundayStart(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 = Sun … 6 = Sat
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

/** Saturday end of the Sunday-anchored week containing `iso`. */
function saturdayEnd(iso: string): string {
  return shiftDay(sundayStart(iso), 6);
}

function firstOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  return `${y}-${pad(m)}-01`;
}

function firstOfPrevMonth(iso: string): string {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  if (m === 1) return `${y - 1}-12-01`;
  return `${y}-${pad(m - 1)}-01`;
}

function lastOfPrevMonth(iso: string): string {
  const [y, m] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, 0)); // day 0 of this month = last of prev
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// resolveDateRange — the public API
// ---------------------------------------------------------------------

export function resolveDateRange(args: {
  period: DateRangeKey;
  from?: string;
  to?: string;
}): ResolvedDateRange {
  const today = todayInNY();
  const [y] = today.split("-").map((n) => parseInt(n, 10));

  switch (args.period) {
    case "this-week": {
      const from = sundayStart(today);
      const to = saturdayEnd(today);
      return { period: "this-week", from, to, label: LABELS["this-week"] };
    }
    case "prev-week": {
      const thisSunday = sundayStart(today);
      const from = shiftDay(thisSunday, -7);
      const to = shiftDay(thisSunday, -1);
      return { period: "prev-week", from, to, label: LABELS["prev-week"] };
    }
    case "this-month":
      return {
        period: "this-month",
        from: firstOfMonth(today),
        to: today,
        label: LABELS["this-month"],
      };
    case "last-month":
      return {
        period: "last-month",
        from: firstOfPrevMonth(today),
        to: lastOfPrevMonth(today),
        label: LABELS["last-month"],
      };
    case "last-7d":
      return {
        period: "last-7d",
        from: shiftDay(today, -6),
        to: today,
        label: LABELS["last-7d"],
      };
    case "last-30d":
      return {
        period: "last-30d",
        from: shiftDay(today, -29),
        to: today,
        label: LABELS["last-30d"],
      };
    case "last-90d":
      return {
        period: "last-90d",
        from: shiftDay(today, -89),
        to: today,
        label: LABELS["last-90d"],
      };
    case "ytd":
      return {
        period: "ytd",
        from: `${y}-01-01`,
        to: today,
        label: LABELS["ytd"],
      };
    case "custom": {
      const ISO = /^\d{4}-\d{2}-\d{2}$/;
      const from = args.from && ISO.test(args.from) ? args.from : sundayStart(today);
      const to = args.to && ISO.test(args.to) ? args.to : today;
      return { period: "custom", from, to, label: LABELS.custom };
    }
  }
}

/** Returns the immediately preceding period of equal length. Used for
 *  period-over-period delta calculation. */
export function priorEqualPeriod(r: ResolvedDateRange): { from: string; to: string } {
  const fromDate = new Date(r.from + "T00:00:00Z").getTime();
  const toDate = new Date(r.to + "T00:00:00Z").getTime();
  const lenDays = Math.round((toDate - fromDate) / 86_400_000) + 1;
  const priorTo = shiftDay(r.from, -1);
  const priorFrom = shiftDay(priorTo, -(lenDays - 1));
  return { from: priorFrom, to: priorTo };
}
