"use client";

import { Row } from "../lib/types";
import { normHostValue } from "../lib/format";

type Props = {
  allRows: Row[];
  viewMode: "bookings" | "invitees";
  setViewMode: (m: "bookings" | "invitees") => void;
  statusFilter: "all" | "active" | "canceled";
  setStatusFilter: (s: "all" | "active" | "canceled") => void;
  funnelFilter: "all" | "on-funnel" | "off-funnel";
  setFunnelFilter: (f: "all" | "on-funnel" | "off-funnel") => void;
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
    funnelFilter,
    setFunnelFilter,
    hostFilter,
    setHostFilter,
    filteredCount,
    onExport,
  } = props;

  const hostHostFiltered = allRows.filter((r) => hostMatches(r, hostFilter));
  const offFunnelInResults = allRows.filter((r) => r.isOffFunnel).length;
  const onFunnelInResults = allRows.length - offFunnelInResults;
  const allHosts = [
    ...new Set(
      allRows
        .flatMap((r) => (r.hostNames.length ? r.hostNames : [r.hostName]))
        .filter((h) => h && h !== "—"),
    ),
  ].sort();

  const uniqueInvitees = new Set(allRows.map((r) => r.inviteeEmail || r.id)).size;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          View
        </span>
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
          <ToggleBtn on={viewMode === "bookings"} onClick={() => setViewMode("bookings")}>
            Bookings ({filteredCount})
          </ToggleBtn>
          <ToggleBtn on={viewMode === "invitees"} onClick={() => setViewMode("invitees")}>
            Group by Invitee ({uniqueInvitees})
          </ToggleBtn>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onExport}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent/40"
          >
            Export CSV ({filteredCount})
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterLabel>Status</FilterLabel>
        <Chip on={statusFilter === "all"} tone="neutral" onClick={() => setStatusFilter("all")}>
          All ({hostHostFiltered.length})
        </Chip>
        <Chip on={statusFilter === "active"} tone="green" onClick={() => setStatusFilter("active")}>
          Active
        </Chip>
        <Chip on={statusFilter === "canceled"} tone="red" onClick={() => setStatusFilter("canceled")}>
          Canceled
        </Chip>

        {offFunnelInResults > 0 && onFunnelInResults > 0 ? (
          <>
            <Divider />
            <FilterLabel>Funnel</FilterLabel>
            <Chip on={funnelFilter === "all"} tone="neutral" onClick={() => setFunnelFilter("all")}>
              All
            </Chip>
            <Chip on={funnelFilter === "on-funnel"} tone="green" onClick={() => setFunnelFilter("on-funnel")}>
              On-funnel ({onFunnelInResults})
            </Chip>
            <Chip on={funnelFilter === "off-funnel"} tone="amber" onClick={() => setFunnelFilter("off-funnel")}>
              Rescheduled away ({offFunnelInResults})
            </Chip>
          </>
        ) : null}

        {allHosts.length > 0 ? (
          <>
            <Divider />
            <FilterLabel>Host</FilterLabel>
            <Chip on={hostFilter === "all"} tone="neutral" onClick={() => setHostFilter("all")}>
              All Hosts
            </Chip>
            {allHosts.map((h) => (
              <Chip
                key={h}
                on={normHostValue(hostFilter) === normHostValue(h)}
                tone="amber"
                onClick={() => setHostFilter(h)}
              >
                {h}
              </Chip>
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}

function ToggleBtn({
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

function Chip({
  on,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  tone: "neutral" | "green" | "red" | "amber";
  onClick: () => void;
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
      className={"rounded-full border px-3 py-1 text-xs font-medium transition " + (on ? onStyles : offStyles)}
    >
      {children}
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}

function hostMatches(r: Row, selectedHost: string): boolean {
  if (!selectedHost || selectedHost === "all") return true;
  const selected = normHostValue(selectedHost);
  const vals = [
    ...r.hostNames,
    ...r.hostEmails,
    r.hostName,
    r.hostEmail,
    r.allHosts,
    r.allHostEmails,
  ]
    .filter(Boolean)
    .map(normHostValue);
  return vals.some((h) => h === selected || h.includes(selected));
}
