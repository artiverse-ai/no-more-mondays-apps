"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchForm } from "./components/SearchForm";
import { ProgressStrip } from "./components/ProgressStrip";
import { Metrics } from "./components/Metrics";
import { FiltersBar, StatusFilter, ViewMode } from "./components/FiltersBar";
import { BookingsTable } from "./components/BookingsTable";
import { InviteesTable } from "./components/InviteesTable";
import { HostsTable } from "./components/HostsTable";
import { JsonModal } from "./components/JsonModal";
import { runSearch } from "./lib/search";
import { PresetKey, Row, SearchProgress, SearchResult } from "./lib/types";
import { exportCsv } from "./lib/csv";
import { normHostValue } from "./lib/format";

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
  const [notes, setNotes] = useState<string[]>([]);
  const [availableNotes, setAvailableNotes] = useState<string[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
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
  const [viewMode, setViewMode] = useState<ViewMode>("bookings");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ---- modal ----
  const [modalRowId, setModalRowId] = useState<string | null>(null);

  const runSearchWith = async (notesToUse: string[]) => {
    if (notesToUse.length === 0) {
      setError("Pick at least one funnel to search for.");
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
        notes: notesToUse,
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

  const onSearch = () => runSearchWith(notes);

  const onCancel = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  // Pull the discrete set of internal_note values on mount. Cached for 5 min
  // server-side, so revisiting the page is instant. Once they land we
  // default-select all and kick off a search so the user lands on populated
  // data instead of an empty form.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/calendly/internal-notes", {
          signal: controller.signal,
        });
        const data: { notes?: string[]; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setNotesError(data.error || `Failed to load funnels (${res.status})`);
          setNotesLoading(false);
          return;
        }
        const all = data.notes ?? [];
        setAvailableNotes(all);
        setNotes(all);
        setNotesLoading(false);
        if (all.length > 0) void runSearchWith(all);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setNotesError((e as Error).message);
          setNotesLoading(false);
        }
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derived ----
  const filtered = useMemo(() => {
    if (!result) return [] as Row[];
    return result.rows
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => hostMatches(r, hostFilter))
      .sort((a, b) => {
        const va = (a[sortField] ?? "") as string | number;
        const vb = (b[sortField] ?? "") as string | number;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [result, statusFilter, hostFilter, sortField, sortDir]);

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
        notes={notes}
        setNotes={setNotes}
        availableNotes={availableNotes}
        notesLoading={notesLoading}
        notesError={notesError}
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
            matchedEventTypes={result.matchedEventTypes}
            debug={result.debug}
            window={result.window}
          />

          <FiltersBar
            allRows={result.rows}
            viewMode={viewMode}
            setViewMode={setViewMode}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            hostFilter={hostFilter}
            setHostFilter={setHostFilter}
            filteredCount={filtered.length}
            onExport={() => exportCsv(filtered)}
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
