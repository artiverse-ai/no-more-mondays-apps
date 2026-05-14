import { getCurrentUser } from "@/lib/auth";
import { listSnapshots } from "@/lib/weekly-report-snapshots";
import { redirect } from "next/navigation";
import { NewSnapshotForm } from "./NewSnapshotForm";
import { SnapshotRow } from "./SnapshotRow";

export const metadata = {
  title: "Weekly Reports — Admin · No More Mondays",
};

export const revalidate = 0;

export default async function AdminWeeklyReportsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  if (!me.isAdmin) redirect("/dashboards/weekly-report");

  const snapshots = await listSnapshots().catch(() => []);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Admin
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Weekly Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a new snapshot. The dynamic dashboard at <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">/dashboards/weekly-report/&lt;slug&gt;</code> reads it on next page load. Editorial content (context banner) is set here; strategic insight cards are edited inline on the snapshot page.
        </p>
      </header>

      <NewSnapshotForm />

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Existing snapshots
        </h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {snapshots.map((s) => (
              <SnapshotRow
                key={s.slug}
                slug={s.slug}
                runOn={s.runOn}
                reportType={s.reportType}
                weekStart={s.weekStart}
                weekEnd={s.weekEnd}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
