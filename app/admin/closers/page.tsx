import { Suspense } from "react";
import { getClosers } from "@/lib/closers";
import { ClosersClient } from "../ClosersClient";
import { ClosersSkeleton } from "../_skeletons";

export const metadata = {
  title: "Closers · Admin · No More Mondays",
};

// Header renders instantly. The BQ query streams in via Suspense, so the
// user sees the heading + description in <50ms, then the table fills in.
export default function AdminClosersPage() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Closers
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The active-closer roster the booking dashboard reads from. Adding,
          pausing, or removing here writes directly to BigQuery
          (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            nmm_calendar.closers
          </code>
          ) and propagates within 5 minutes.
        </p>
      </div>
      <Suspense fallback={<ClosersTableFallback />}>
        <ClosersData />
      </Suspense>
    </section>
  );
}

async function ClosersData() {
  try {
    const closers = await getClosers();
    return <ClosersClient initial={closers} />;
  } catch (e) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Could not load closers: {(e as Error).message}
      </div>
    );
  }
}

function ClosersTableFallback() {
  // The header is already shown by the parent; this skeleton fills only the
  // table area, not the page chrome.
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 rounded-xl border border-border bg-card" />
        <div className="h-24 rounded-xl border border-border bg-card" />
        <div className="h-24 rounded-xl border border-border bg-card" />
      </div>
      <div className="h-24 rounded-2xl border border-border bg-card" />
      <div className="h-64 rounded-2xl border border-border bg-card" />
    </div>
  );
}
