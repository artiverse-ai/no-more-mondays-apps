// Shared "under development" UI for dashboards that aren't ready for
// executive consumption yet.
//
//  - <UnderDevelopmentGate>  : full-page placeholder shown to exec-mode
//    viewers in place of the dashboard. No data is queried.
//  - <UnderDevelopmentBanner>: slim in-page banner shown above the real
//    dashboard when a dev-mode viewer opens it, so they know the numbers
//    aren't signed off yet.

import Link from "next/link";

export function UnderDevelopmentGate({
  title,
}: {
  /** e.g. "Sales Performance" */
  title: string;
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-alert-orange/40 bg-alert-orange/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-alert-orange">
        Under development
      </span>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        This dashboard is still being built and validated against the
        Monday-report spec. It&rsquo;s hidden from the executive view until
        the numbers are signed off — visible only in <strong>Dev view</strong>{" "}
        for now.
      </p>
      <p className="text-xs text-muted-foreground">
        An admin can enable Dev view from the toggle in the top bar to
        preview work-in-progress.
      </p>
      <Link
        href="/dashboards/webinar"
        className="mt-2 inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-foreground/40"
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        ← Back to Webinar Performance
      </Link>
    </main>
  );
}

export function UnderDevelopmentBanner() {
  return (
    <p className="rounded-xl border border-alert-orange/30 bg-alert-orange/5 px-4 py-2.5 text-[12px] leading-relaxed text-foreground">
      <strong className="font-semibold text-alert-orange">
        Under development —
      </strong>{" "}
      this dashboard is visible in Dev view only and is still being validated
      against the Monday-report spec. Numbers may change; not yet executive-ready.
    </p>
  );
}
