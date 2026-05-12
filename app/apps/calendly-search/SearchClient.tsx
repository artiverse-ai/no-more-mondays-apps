"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchForm } from "./components/SearchForm";
import { ProgressStrip } from "./components/ProgressStrip";
import { Metrics } from "./components/Metrics";
import {
  CloserScope,
  FiltersBar,
  StatusFilter,
  ViewMode,
} from "./components/FiltersBar";
import { BookingsTable } from "./components/BookingsTable";
import { InviteesTable } from "./components/InviteesTable";
import { HostsTable } from "./components/HostsTable";
import { CalendarView } from "./components/CalendarView";
import { JsonModal } from "./components/JsonModal";
import { runSearch } from "./lib/search";
import { PresetKey, Row, SearchProgress, SearchResult } from "./lib/types";
import { exportCsv } from "./lib/csv";
import { normHostValue } from "./lib/format";

const TITLE_PREFIX = "Strategy";

type SortField =
  | "inviteeName"
  | "inviteeEmail"
  | "status"
  | "eventTypeName"
  | "internalNote"
  | "hostName"
  | "startTime"
  | "createdAt";

export function SearchClient() {
  // ---- closer roster ----
  const [activeClosers, setActiveClosers] = useState<Set<string>>(new Set());
  const [inactiveClosers, setInactiveClosers] = useState<Set<string>>(new Set());
  const [closersLoading, setClosersLoading] = useState(true);
  const [closersError, setClosersError] = useState<string | null>(null);

  // ---- search inputs ----
  const [presetKey, setPresetKey] = useState<PresetKey>("future");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // ---- pipeline state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- view + filters ----
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [closerScope, setCloserScope] = useState<CloserScope>("all");
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ---- modal ----
  const [modalRowId, setModalRowId] = useState<string | null>(null);

  const runSearchWithPreset = async (presetForRun: PresetKey) => {
    if (presetForRun === "custom" && (!customStart || !customEnd)) {
      setError("Select both start and end dates for custom range.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setProgress(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await runSearch({
        titlePrefix: TITLE_PREFIX,
        presetKey: presetForRun,
        customStart,
        customEnd,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setResult(res);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const onSearch = () => runSearchWithPreset(presetKey);

  const onCancel = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  // Pull the closer roster + kick off the default Strategy search on mount.
  // Both happen in parallel — search doesn't depend on closer data (it's
  // applied as a post-filter), so we don't block the slow search on the
  // fast BQ lookup.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/closers", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data: { active?: string[]; inactive?: string[]; error?: string } =
          await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setClosersError(data.error || `Failed to load closers (${res.status})`);
        } else {
          setActiveClosers(new Set((data.active ?? []).map((e) => e.toLowerCase())));
          setInactiveClosers(new Set((data.inactive ?? []).map((e) => e.toLowerCase())));
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setClosersError((e as Error).message);
        }
      } finally {
        setClosersLoading(false);
      }
    })();
    // Defer the auto-search by a microtask so the closers fetch and the
    // search-pipeline state updates land in separate ticks (avoids the
    // cascading-render lint).
    queueMicrotask(() => void runSearchWithPreset(presetKey));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derived ----
  const filtered = useMemo(() => {
    if (!result) return [] as Row[];
    return result.rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => closerScopeMatches(r, closerScope, activeClosers, inactiveClosers))
      .filter((r) => hostMatches(r, hostFilter))
      .sort((a, b) => {
        const va = (a[sortField] ?? "") as string | number;
        const vb = (b[sortField] ?? "") as string | number;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [result, statusFilter, closerScope, activeClosers, inactiveClosers, hostFilter, sortField, sortDir]);

  const onSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const modalRow = modalRowId && result ? result.rawById.get(modalRowId) ?? null : null;

  return (
    <div className="space-y-6">
      <SearchForm
        presetKey={presetKey}
        setPresetKey={setPresetKey}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        loading={loading}
        onSearch={onSearch}
        onCancel={onCancel}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {closersError ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800">
          Couldn&apos;t load the closer roster: {closersError}. Closer-scope
          filtering will fall back to All.
        </div>
      ) : null}

      {loading ? (
        <ProgressStrip progress={progress} initialMessage="Starting search…" />
      ) : null}

      {result ? (
        <>
          <Metrics
            rows={filtered}
            allRows={result.rows.filter((r) =>
              closerScopeMatches(r, closerScope, activeClosers, inactiveClosers),
            )}
            hostFilter={hostFilter}
            matchedEventTypes={result.matchedEventTypes}
            debug={result.debug}
            window={result.window}
          />

          <FiltersBar
            allRows={result.rows.filter((r) =>
              closerScopeMatches(r, closerScope, activeClosers, inactiveClosers),
            )}
            viewMode={viewMode}
            setViewMode={setViewMode}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            closerScope={closerScope}
            setCloserScope={setCloserScope}
            closersLoading={closersLoading}
            hostFilter={hostFilter}
            setHostFilter={setHostFilter}
            filteredCount={filtered.length}
            onExport={() => exportCsv(filtered)}
          />

          {viewMode === "calendar" ? (
            <CalendarView
              rows={filtered}
              matchedEventTypes={result.matchedEventTypes}
              onInspect={setModalRowId}
            />
          ) : viewMode === "bookings" ? (
            <BookingsTable
              rows={filtered}
              total={result.rows.length}
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
              matchedEventTypes={result.matchedEventTypes}
              onInspect={setModalRowId}
            />
          ) : viewMode === "invitees" ? (
            <InviteesTable
              rows={filtered}
              totalRows={result.rows.length}
              matchedEventTypes={result.matchedEventTypes}
              onInspect={setModalRowId}
            />
          ) : (
            <HostsTable
              rows={filtered}
              totalRows={result.rows.length}
              matchedEventTypes={result.matchedEventTypes}
              onInspect={setModalRowId}
            />
          )}
        </>
      ) : null}

      {modalRow ? (
        <JsonModal data={modalRow} onClose={() => setModalRowId(null)} />
      ) : null}
    </div>
  );
}

function closerScopeMatches(
  r: Row,
  scope: CloserScope,
  active: Set<string>,
  inactive: Set<string>,
): boolean {
  if (scope === "all") return true;
  const hostEmails = [r.hostEmail, ...r.hostEmails]
    .map((e) => (e || "").trim().toLowerCase())
    .filter(Boolean);
  if (hostEmails.length === 0) return false;
  if (scope === "active") return hostEmails.some((e) => active.has(e));
  // scope === "inactive" — host is in the roster but NOT currently active.
  // We require at least one inactive match and no active match, otherwise an
  // event hosted by both an inactive and an active closer would double-count.
  const anyInactive = hostEmails.some((e) => inactive.has(e));
  const anyActive = hostEmails.some((e) => active.has(e));
  return anyInactive && !anyActive;
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
