// Human-readable date-range labels for scorecard metrics so the user
// always sees which window each number reflects.
//
// Why this exists: the dashboard mixes several time windows
//   - Sales week (Sun-Sat ET) — closer/funnel/cash metrics
//   - Marketing week (Mon-Sun ET) — webinar/ad-spend metrics
//   - Last 3 webinars rolling — avg show rate
//   - Single date — the latest webinar
// Without explicit labels, a CEO looking at "131 calls booked" can't tell
// if it's this week, last week, or rolling. Every scorecard should carry
// its window so the answer is unambiguous.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-10" → "May 10" (no year) or "May 10, 2026" (with year). */
export function fmtShortDate(iso: string, includeYear = false): string {
  const d = new Date(iso + "T00:00:00Z");
  const m = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  return includeYear ? `${m} ${day}, ${d.getUTCFullYear()}` : `${m} ${day}`;
}

/**
 * Format a date range compactly:
 *   same month, same year:  "May 10–16, 2026"
 *   different months:       "Apr 28 – May 4, 2026"
 *   different years:        "Dec 28, 2025 – Jan 3, 2026"
 */
export function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sameMonth = sameYear && s.getUTCMonth() === e.getUTCMonth();
  if (sameMonth) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()} – ${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  return `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}, ${s.getUTCFullYear()} – ${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

/** "Sales week · May 10–16, 2026 (Sun–Sat)" */
export function salesWeekLabel(kpiStart: string, kpiEnd: string): string {
  return `Sales week · ${fmtDateRange(kpiStart, kpiEnd)} (Sun–Sat ET)`;
}

/** "Marketing week · May 11–17, 2026 (Mon–Sun)" */
export function marketingWeekLabel(mwStart: string, mwEnd: string): string {
  return `Marketing week · ${fmtDateRange(mwStart, mwEnd)} (Mon–Sun ET)`;
}

/** "Last 3 webinars (through May 17)" — anchored on the latest webinar date. */
export function lastThreeWebinarsLabel(latestWebinarDate: string): string {
  return `Last 3 webinars (through ${fmtShortDate(latestWebinarDate)})`;
}
