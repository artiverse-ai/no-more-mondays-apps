"use client";

import { Row } from "../lib/types";

export type ViewMode = "bookings" | "invitees" | "hosts";
export type StatusFilter = "all" | "active" | "canceled";

type Props = {
  allRows: Row[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  hostFilter: string;
  setHostFilter: (h: string) => void;
  filteredCount: number;
  onExport: () => void;
};

export function FiltersBar(props: Props) {
  const {
    allRows,
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    hostFilter,
    setHostFilter,
    filteredCount,
    onExport,
  } = props;

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
        {/* Tabs: bookings / by invitee / by host */}
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
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

        <div className="h-5 w-px bg-border" />

        {/* Status chips — compact */}
        <div className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Status
          </span>
          <Chip on={statusFilter === "all"} tone="neutral" onClick={() => setStatusFilter("all")}>
            All
          </Chip>
          <Chip on={statusFilter === "active"} tone="green" onClick={() => setStatusFilter("active")}>
            Active
          </Chip>
          <Chip on={statusFilter === "canceled"} tone="red" onClick={() => setStatusFilter("canceled")}>
            Canceled
          </Chip>
        </div>

        {/* Host dropdown — replaces the long row of host chips */}
        {allHosts.length > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="inline-flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Host
              </span>
              <select
                value={hostFilter}
                onChange={(e) => setHostFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground outline-none transition hover:border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="all">All hosts ({allHosts.length})</option>
                {allHosts.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              {hostFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setHostFilter("all")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Clear host filter"
                >
                  ×
                </button>
              )}
            </div>
          </>
        )}

        {/* Export */}
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

function Chip({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  tone: "neutral" | "green" | "red";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const onStyles =
    tone === "green"
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
      : tone === "red"
      ? "border-rose-500/50 bg-rose-500/10 text-rose-700"
      : "border-primary bg-primary/10 text-primary";
  const offStyles =
    "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={"rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition " + (on ? onStyles : offStyles)}
    >
      {children}
    </button>
  );
}

