import { getClosers } from "@/lib/closers";
import { ClosersClient } from "../ClosersClient";

export const metadata = {
  title: "Closers · Admin · No More Mondays",
};

export default async function AdminClosersPage() {
  let closers: Awaited<ReturnType<typeof getClosers>> = [];
  let error: string | null = null;
  try {
    closers = await getClosers();
  } catch (e) {
    error = (e as Error).message;
  }

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
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load closers: {error}
        </div>
      ) : (
        <ClosersClient initial={closers} />
      )}
    </section>
  );
}
