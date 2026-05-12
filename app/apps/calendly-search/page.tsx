import { SearchClient } from "./SearchClient";

export const metadata = {
  title: "Calendly Internal Note Search · No More Mondays",
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-6 md:p-10">
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          No More Mondays &middot; Sales Ops
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Calendly Internal Note Search
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Find bookings whose event-type
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">internal_note</code>
          matches one of the selected values. The picker is populated from
          every active event type across the org, then we query scheduled
          events org-wide and filter locally. Host is read from
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">event_memberships</code>.
        </p>
      </header>

      <SearchClient />
    </main>
  );
}
