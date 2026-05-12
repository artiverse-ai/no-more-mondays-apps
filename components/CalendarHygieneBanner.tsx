import Link from "next/link";
import type { CloserHygiene, HygieneReason } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

const REASON_LABEL: Record<HygieneReason, string> = {
  sparse_events: "thin calendar",
  low_coverage: "low coverage",
};

function reasonsLabel(reasons: HygieneReason[]): string {
  if (reasons.length === 0) return "";
  return reasons.map((r) => REASON_LABEL[r]).join(" · ");
}

export function CalendarHygieneBanner({
  hygiene,
}: {
  hygiene: CloserHygiene[];
}) {
  const flagged = hygiene
    .filter((h) => h.reasons.length > 0)
    .sort((a, b) => a.events_per_day - b.events_per_day);

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
              Calendar hygiene warning
            </p>
            <p className="mt-1 text-xs text-amber-900/80">
              {flagged.length === 1
                ? "This closer has"
                : `${flagged.length} closers have`}{" "}
              a thinly populated calendar for this date range — too few events
              and/or too little blocked time. The dashboard still offers them
              for slots, but bookings could land on top of real busy time
              they haven&rsquo;t marked. Closers live in different timezones,
              so we check signals that don&rsquo;t depend on their TZ.
            </p>
          </div>
          <div className="overflow-hidden rounded-md border border-amber-500/30 bg-amber-50/50">
            <table className="w-full text-xs">
              <thead className="text-amber-900/70">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Closer</th>
                  <th className="px-3 py-1.5 text-right font-medium">
                    Events/day
                  </th>
                  <th className="px-3 py-1.5 text-right font-medium">
                    Coverage
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((h) => (
                  <tr
                    key={h.email}
                    className="border-t border-amber-500/20 text-amber-900"
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {shortName(h.email)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {h.events_per_day.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {Math.round(h.coverage_pct * 100)}%
                    </td>
                    <td className="px-3 py-1.5">{reasonsLabel(h.reasons)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-900/80">
            Fix: send them the{" "}
            <Link
              href="/sops/closer-calendar-management"
              className="font-medium text-amber-900 underline underline-offset-2"
            >
              calendar management SOP
            </Link>
            . Or pause them via{" "}
            <Link
              href="/admin/closers"
              className="font-medium text-amber-900 underline underline-offset-2"
            >
              /admin/closers
            </Link>{" "}
            (flip <em>Available</em> off) until they&rsquo;ve set things up.
          </p>
        </div>
      </div>
    </aside>
  );
}
