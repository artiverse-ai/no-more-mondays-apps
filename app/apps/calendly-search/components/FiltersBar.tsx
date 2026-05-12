"use client";

import { Row } from "../lib/types";

export type ViewMode = "bookings" | "invitees" | "hosts";
export type StatusFilter = "all" | "active" | "canceled";
export type CloserScope = "all" | "active" | "inactive";

type Props = {
  allRows: Row[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  closerScope: CloserScope;
  setCloserScope: (s: CloserScope) => void;
  closersLoading: boolean;
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
    closerScope,
    setCloserScope,
    closersLoading,
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
    <section className="space-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      {/* Closer scope — sits at the top because it's the primary semantic
          filter for this dashboard ("show me closer calls only"). */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterLabel>Closer</FilterLabel>
        <Chip on={closerScope === "all"} tone="neutral" onClick={() => setCloserScope("all")}>
          All hosts
        </Chip>
        <Chip
          on={closerScope === "active"}
          tone="green"
          onClick={() => setCloserScope("active")}
          disabled={closersLoading}
        >
          Active closers
        </Chip>
        <Chip
          on={closerScope === "inactive"}
          tone="amber"
          onClick={() => setCloserScope("inactive")}
          disabled={closersLoading}
        >
          Inactive closers
        </Chip>
        {closersLoading && (
          <span className="text-[10px] text-muted-foreground">
            loading roster…
          </span>
        )}
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-wrap items-center gap-3">
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

        <div className="inline-flex items-center gap-1.5">
          <FilterLabel>Status</FilterLabel>
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

        {allHosts.length > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="inline-flex items-center gap-2">
              <FilterLabel>Host</FilterLabel>
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
  disabled,
  children,
}: {
  on: boolean;
  tone: "neutral" | "green" | "red" | "amber";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const onStyles =
    tone === "green"
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
      : tone === "red"
      ? "border-rose-500/50 bg-rose-500/10 text-rose-700"
      : tone === "amber"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
      : "border-primary bg-primary/10 text-primary";
  const offStyles =
    "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 " +
        (on ? onStyles : offStyles)
      }
    >
      {children}
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}
