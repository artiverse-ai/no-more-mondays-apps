import { SearchClient } from "./SearchClient";

export const metadata = {
  title: "Funnel Search · No More Mondays",
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-6 md:p-10">
      <header className="space-y-1 border-b border-border pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          No More Mondays &middot; Sales Ops
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          Funnel Search
        </h1>
        <p className="text-sm text-muted-foreground">
          Find Calendly bookings by funnel tag.
        </p>
      </header>

      <SearchClient />
    </main>
  );
}
