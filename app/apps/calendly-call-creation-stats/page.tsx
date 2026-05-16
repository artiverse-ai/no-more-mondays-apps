import { SearchClient } from "./SearchClient";

export const metadata = {
  title: "Calendly Call Creation Stats · No More Mondays",
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Sales Ops
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Calendly Call Creation Stats
          </h1>
          <p className="text-sm text-muted-foreground">
            Find Calendly bookings by <strong>when they were created</strong>{" "}
            (not when the call is scheduled). Default range is the last
            30 days. Same funnel-tag filters, hosts, and charts as Funnel
            Search.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            ⏱ Searches typically take <strong>60–120 seconds</strong> —
            Calendly&apos;s API is the bottleneck. Be patient on first
            load; the loading strip shows progress.
          </p>
        </div>
        <a
          href="https://www.notion.so/nomoremondays/SOP-Calendly-Call-Creation-Stats-3629b9a6796a80a5b3a5e28c877dcab8"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center rounded-md border border-alert-blue/40 bg-alert-blue/10 px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-alert-blue shadow-sm transition-colors hover:bg-alert-blue/15"
          title="Open the Calendly Call Creation Stats SOP in Notion"
        >
          📖 SOP
        </a>
      </header>

      <SearchClient />
    </main>
  );
}
