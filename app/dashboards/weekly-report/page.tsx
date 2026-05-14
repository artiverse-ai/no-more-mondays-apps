import Link from "next/link";

export const metadata = {
  title: "Weekly Reports · No More Mondays",
};

// One entry per snapshot. Add a new line + a new folder under
// app/dashboards/weekly-report/<slug>/ when a new report ships.
//
// Reports cadence: Monday (full prior-week recap) + Thursday (midweek check).
type Snapshot = {
  slug: string;
  /** Day the report was generated, in human form. */
  runOn: string;
  /** Week the report covers. */
  weekCovered: string;
  /** Mon = "Weekly recap", Thu = "Midweek check". */
  type: "Weekly recap" | "Midweek check";
  /** ISO date used to sort newest-first. */
  sortKey: string;
};

const SNAPSHOTS: Snapshot[] = [
  {
    slug: "2026-05-03",
    runOn: "Mon, May 11, 2026",
    weekCovered: "May 3–9, 2026",
    type: "Weekly recap",
    sortKey: "2026-05-11",
  },
];

export default function WeeklyReportsIndex() {
  const sorted = [...SNAPSHOTS].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          No More Mondays
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Weekly Reports
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          One snapshot per Monday and Thursday. Mondays are a full recap of
          the prior week; Thursdays are a midweek check on the current cycle.
        </p>
      </header>

      <section className="space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No snapshots yet.
          </div>
        ) : (
          sorted.map((s) => (
            <Link
              key={s.slug}
              href={`/dashboards/weekly-report/${s.slug}`}
              className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-accent hover:shadow-md"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    {s.runOn}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {s.type} · Week {s.weekCovered}
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  Open →
                </span>
              </div>
            </Link>
          ))
        )}
      </section>

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        New report? Drop a folder at{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
          app/dashboards/weekly-report/&lt;slug&gt;/
        </code>{" "}
        and add an entry to the <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">SNAPSHOTS</code> list in this file.
      </p>
    </main>
  );
}
