"use client";

import { Row } from "../lib/types";

export type ViewMode = "calendar" | "bookings" | "invitees" | "hosts";
// Richer call-status filter for the creation-stats app — driven by
// r.callStatus (future / held / no_show / canceled / unknown) instead
// of the raw Calendly status.
export type StatusFilter = "all" | "future" | "held" | "no_show" | "canceled" | "unknown";
export type CloserScope = "all" | "active" | "inactive";

type Props = {
  allRows: Row[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  filteredCount: number;
  onExport: () => void;
};

// The only thing in this bar now is the view toggle and the Export button —
// all the filters (Status, Closer, Host) live in the top SearchForm panel
// alongside Internal Note and Call Time, as dropdowns.
export function FiltersBar({
  allRows,
  viewMode,
  setViewMode,
  filteredCount,
  onExport,
}: Props) {
  const uniqueInvitees = new Set(allRows.map((r) => r.inviteeEmail || r.id)).size;
  const allHosts = [
    ...new Set(
      allRows
        .flatMap((r) => (r.hostNames.length ? r.hostNames : [r.hostName]))
        .filter((h) => h && h !== "—"),
    ),
  ].sort();

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
          <Tab on={viewMode === "calendar"} onClick={() => setViewMode("calendar")}>
            Calendar
          </Tab>
          <Tab on={viewMode === "bookings"} onClick={() => setViewMode("bookings")}>
            Bookings <Count n={filteredCount} />
          </Tab>
          <Tab on={viewMode === "invitees"} onClick={() => setViewMode("invitees")}>
            By Invitee <Count n={uniqueInvitees} />
          </Tab>
          <Tab on={viewMode === "hosts"} onClick={() => setViewMode("hosts")}>
            By Host <Count n={allHosts.length} />
          </Tab>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="ml-auto rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/40"
        >
          Export CSV ({filteredCount})
        </button>
      </div>
    </section>
  );
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-xs font-medium transition " +
        (on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1 opacity-70">({n})</span>;
}
