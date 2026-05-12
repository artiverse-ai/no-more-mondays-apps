import { SearchClient } from "./SearchClient";

export const metadata = {
  title: "Strategy Calls · No More Mondays",
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-6 md:p-10">
      <header className="space-y-1 border-b border-border pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          No More Mondays &middot; Sales Ops
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Strategy Calls
        </h1>
        <p className="text-sm text-muted-foreground">
          Every Calendly booking on a Strategy-titled event type. Filter by
          closer scope to narrow to active or inactive closer hosts.
        </p>
      </header>

      <SearchClient />
    </main>
  );
}
