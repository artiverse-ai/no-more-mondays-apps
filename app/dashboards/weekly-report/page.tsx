import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listSnapshots, type Snapshot } from "@/lib/weekly-report-snapshots";

export const metadata = {
  title: "Weekly Reports · No More Mondays",
};

// Snapshots come from BQ now. revalidate=0 keeps the list fresh as admins
// create new entries via /admin/weekly-reports.
export const revalidate = 0;

const REPORT_TYPE_LABEL: Record<string, string> = {
  weekly_recap: "Weekly recap",
  midweek_check: "Midweek check",
};

function fmtRunOn(iso: string): string {
  // iso = "YYYY-MM-DD"; render as "Mon, May 11, 2026" in UTC so it doesn't
  // shift based on the viewer's timezone.
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startLabel = s.toLocaleDateString("en-US", opts);
  const endLabel = e.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export default async function WeeklyReportsIndex() {
  const user = await getCurrentUser();
  let snapshots: Snapshot[] = [];
  let error: string | null = null;
  try {
    snapshots = await listSnapshots();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          No More Mondays
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Weekly Reports
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              One snapshot per Monday and Thursday. Mondays are a full recap of
              the prior Sun-Sat week; Thursdays are a midweek check on Sun-Wed
              of the current week.
            </p>
          </div>
          {user?.isAdmin ? (
            <Link
              href="/admin/weekly-reports"
              className="shrink-0 rounded-lg border border-accent bg-accent/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-accent transition hover:bg-accent/20"
            >
              + New snapshot
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
          Couldn&apos;t load snapshots from BigQuery: {error}
        </div>
      ) : null}

      <section className="space-y-3">
        {snapshots.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No snapshots yet.
            {user?.isAdmin ? (
              <>
                {" "}
                <Link href="/admin/weekly-reports" className="text-accent underline">
                  Create the first one →
                </Link>
              </>
            ) : null}
          </div>
        ) : (
          snapshots.map((s) => (
            <Link
              key={s.slug}
              href={`/dashboards/weekly-report/${s.slug}`}
              className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-accent hover:shadow-md"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    {fmtRunOn(s.runOn)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {REPORT_TYPE_LABEL[s.reportType] ?? s.reportType} · Week{" "}
                    {fmtRange(s.weekStart, s.weekEnd)}
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
    </main>
  );
}
