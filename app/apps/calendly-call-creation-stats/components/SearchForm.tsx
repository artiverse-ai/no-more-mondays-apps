"use client";

import { MultiSelect } from "@/components/MultiSelect";
import { PRESETS, PresetKey } from "../lib/types";
import { CloserScope, StatusFilter } from "./FiltersBar";

type Props = {
  // Internal Note (pre-search filter)
  notes: string[];
  setNotes: (v: string[]) => void;
  availableNotes: string[];
  notesLoading: boolean;
  notesError: string | null;

  // Strategy-only toggle
  strategyOnly: boolean;
  setStrategyOnly: (v: boolean) => void;

  // Call Time (pre-search)
  presetKey: PresetKey;
  setPresetKey: (k: PresetKey) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;

  // Post-search filters (applied to results)
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  closerScope: CloserScope;
  setCloserScope: (s: CloserScope) => void;
  closersLoading: boolean;
  hostFilter: string;
  setHostFilter: (h: string) => void;
  availableHosts: string[];

  loading: boolean;
  onSearch: () => void;
  onCancel: () => void;
};

export function SearchForm(props: Props) {
  const {
    notes,
    setNotes,
    availableNotes,
    notesLoading,
    notesError,
    strategyOnly,
    setStrategyOnly,
    presetKey,
    setPresetKey,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    statusFilter,
    setStatusFilter,
    closerScope,
    setCloserScope,
    closersLoading,
    hostFilter,
    setHostFilter,
    availableHosts,
    loading,
    onSearch,
    onCancel,
  } = props;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Internal Note — multi-select. Spans wider since it has many options. */}
        <div className="md:col-span-2 xl:col-span-1">
          <Label>Internal Note (Funnel)</Label>
          <MultiSelect
            options={availableNotes}
            value={notes}
            onChange={setNotes}
            loading={notesLoading}
            placeholder="Pick funnels…"
            emptyMessage={
              notesError
                ? "Couldn't load funnels — check CALENDLY_PAT"
                : "No funnels set on any event type"
            }
            searchPlaceholder="Search funnels…"
          />
          {notesError ? (
            <p className="mt-1.5 text-xs text-destructive">{notesError}</p>
          ) : null}
        </div>

        {/* Call Time */}
        <div>
          <Label>Call Time</Label>
          <Dropdown
            value={presetKey}
            onChange={(v) => setPresetKey(v as PresetKey)}
            options={PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
          {presetKey === "custom" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
            </div>
          ) : null}
        </div>

        {/* Status */}
        <div>
          <Label>Status</Label>
          <Dropdown
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "canceled", label: "Canceled" },
            ]}
          />
        </div>

        {/* Closer scope */}
        <div>
          <Label>Closer</Label>
          <Dropdown
            value={closerScope}
            onChange={(v) => setCloserScope(v as CloserScope)}
            disabled={closersLoading}
            options={[
              { value: "all", label: "All hosts" },
              { value: "active", label: "Active closers" },
              { value: "inactive", label: "Inactive closers" },
            ]}
            hint={closersLoading ? "loading roster…" : undefined}
          />
        </div>

        {/* Host */}
        <div>
          <Label>Host</Label>
          <Dropdown
            value={hostFilter}
            onChange={(v) => setHostFilter(v)}
            disabled={availableHosts.length === 0}
            options={[
              { value: "all", label: `All hosts${availableHosts.length > 0 ? ` (${availableHosts.length})` : ""}` },
              ...availableHosts.map((h) => ({ value: h, label: h })),
            ]}
            hint={
              availableHosts.length === 0
                ? "no results yet"
                : undefined
            }
          />
        </div>

        {/* Strategy-only checkbox spans the bottom row */}
        <div className="md:col-span-2 xl:col-span-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={strategyOnly}
              onChange={(e) => setStrategyOnly(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            <span className="font-medium text-foreground">
              Only Strategy-titled calls
            </span>
            <span className="text-muted-foreground">
              (event type name starts with &ldquo;Strategy&rdquo;)
            </span>
          </label>
          <div className="flex items-center gap-3">
            {loading ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSearch}
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </label>
  );
}

function Dropdown({
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition hover:border-accent/40 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
