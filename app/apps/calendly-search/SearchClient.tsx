"use client";

import { useMemo, useRef, useState } from "react";
import { SearchForm } from "./components/SearchForm";
import { ProgressStrip } from "./components/ProgressStrip";
import { Metrics } from "./components/Metrics";
import { FiltersBar } from "./components/FiltersBar";
import { BookingsTable } from "./components/BookingsTable";
import { InviteesTable } from "./components/InviteesTable";
import { JsonModal } from "./components/JsonModal";
import { runSearch } from "./lib/search";
import {
  DateFilterMode,
  PresetKey,
  Row,
  SearchProgress,
  SearchResult,
} from "./lib/types";
import { exportCsv } from "./lib/csv";
import { normHostValue } from "./lib/format";

type ViewMode = "bookings" | "invitees";
type StatusFilter = "all" | "active" | "canceled";
type FunnelFilter = "all" | "on-funnel" | "off-funnel";
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
  // ---- search inputs ----
  const [note, setNote] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("booked");
  const [presetKey, setPresetKey] = useState<PresetKey>("last7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // ---- pipeline state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ---- view + filters ----
  const [viewMode, setViewMode] = useState<ViewMode>("bookings");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>("all");
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ---- modal ----
  const [modalRowId, setModalRowId] = useState<string | null>(null);

  const onSearch = async () => {
    if (!note.trim()) {
      setError("Enter internal note text to search for.");
      return;
    }
    if (presetKey === "custom" && (!customStart || !customEnd)) {
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
        note: note.trim(),
        dateFilterMode,
        presetKey,
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

  const onCancel = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  // ---- derived ----
  const filtered = useMemo(() => {
    if (!result) return [] as Row[];
    return result.rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => hostMatches(r, hostFilter))
      .filter((r) =>
        funnelFilter === "all" ? true : funnelFilter === "on-funnel" ? !r.isOffFunnel : r.isOffFunnel,
      )
      .sort((a, b) => {
        const va = (a[sortField] ?? "") as string | number;
        const vb = (b[sortField] ?? "") as string | number;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [result, statusFilter, hostFilter, funnelFilter, sortField, sortDir]);

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
        note={note}
        setNote={setNote}
        dateFilterMode={dateFilterMode}
        setDateFilterMode={setDateFilterMode}
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

      {loading && progress ? <ProgressStrip progress={progress} /> : null}

      {result ? (
        <>
          <Metrics
            rows={filtered}
            allRows={result.rows}
            hostFilter={hostFilter}
            funnelFilter={funnelFilter}
            matchedEventTypes={result.matchedEventTypes}
            debug={result.debug}
            dateFilterMode={dateFilterMode}
          />

          <FiltersBar
            allRows={result.rows}
            viewMode={viewMode}
            setViewMode={setViewMode}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            funnelFilter={funnelFilter}
            setFunnelFilter={setFunnelFilter}
            hostFilter={hostFilter}
            setHostFilter={setHostFilter}
            filteredCount={filtered.length}
            onExport={() => exportCsv(filtered, dateFilterMode)}
          />

          {viewMode === "bookings" ? (
            <BookingsTable
              rows={filtered}
              total={result.rows.length}
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
              matchedEventTypes={result.matchedEventTypes}
              onInspect={setModalRowId}
            />
          ) : (
            <InviteesTable
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
