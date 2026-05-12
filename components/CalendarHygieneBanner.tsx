import Link from "next/link";
import type { CloserHygiene } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

const hoursPerDay = (h: CloserHygiene): string => {
  if (h.range_total_min <= 0) return "—";
  // range_total_min spans the full calendar window — busy_min / days = hours-per-day average
  const days = h.range_total_min / 1440;
  const hours = h.busy_min / 60;
  return (hours / days).toFixed(1) + "h/day";
};

export function CalendarHygieneBanner({
  hygiene,
}: {
  hygiene: CloserHygiene[];
}) {
  const flagged = hygiene
    .filter((h) => h.is_low_coverage)
    .sort((a, b) => a.coverage_pct - b.coverage_pct);

  if (flagged.length === 0) return null;

  return (
    <aside
      role="status"
      className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none">
          ⚠️
        </span>
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-heading text-sm font-semibold text-amber-900">
              Calendar coverage warning
            </p>
            <p className="mt-1 text-xs text-amber-900/80">
              {flagged.length === 1 ? "This closer has" : `${flagged.length} closers have`}{" "}
              suspiciously empty calendar
              {flagged.length === 1 ? "" : "s"} for this date range — likely
              haven&rsquo;t blocked sleep, lunch, or other busy time. The
              dashboard will offer bookings into those gaps.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {flagged.map((h) => (
              <li
                key={h.email}
                className="flex items-baseline justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-amber-900">
                  {shortName(h.email)}
                </span>
                <span className="font-mono text-amber-900/80">
                  {Math.round(h.coverage_pct * 100)}% &middot; {hoursPerDay(h)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-900/80">
            Fix: send them the{" "}
            <Link
              href="/sops/closer-calendar-management"
              className="font-medium text-amber-900 underline underline-offset-2"
            >
              calendar management SOP
            </Link>
            . Or pause them via the{" "}
            <Link
              href="/admin/closers"
              className="font-medium text-amber-900 underline underline-offset-2"
            >
              admin page
            </Link>{" "}
            (flip Available off) until they&rsquo;ve set up blockers.
          </p>
        </div>
      </div>
    </aside>
  );
}
