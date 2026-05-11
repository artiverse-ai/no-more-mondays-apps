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
          Find bookings whose event-type internal note contains a substring (e.g.
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">setter</code>,
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">vip</code>,
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">webinar</code>).
          Iterates per-user event types (org endpoint omits shared/round-robin),
          then queries org-wide scheduled events and filters locally. Reads
          host from <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">event_memberships</code>.
        </p>
      </header>

      <SearchClient />
    </main>
  );
}
