"use client";

import { MultiSelect } from "@/components/MultiSelect";
import { PRESETS, PresetKey } from "../lib/types";

type Props = {
  notes: string[];
  setNotes: (v: string[]) => void;
  availableNotes: string[];
  notesLoading: boolean;
  notesError: string | null;
  strategyOnly: boolean;
  setStrategyOnly: (v: boolean) => void;
  presetKey: PresetKey;
  setPresetKey: (k: PresetKey) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
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
    loading,
    onSearch,
    onCancel,
  } = props;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-5">
        <div>
          <Label>Internal Note (Funnel)</Label>
          <MultiSelect
            options={availableNotes}
            value={notes}
            onChange={setNotes}
            loading={notesLoading}
            placeholder="Pick one or more funnels…"
            emptyMessage={
              notesError
                ? "Couldn't load funnels — check CALENDLY_PAT"
                : "No funnels set on any event type"
            }
            searchPlaceholder="Search funnels…"
          />
          {notesError ? (
            <p className="mt-1.5 text-xs text-destructive">{notesError}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pulled from every event type&apos;s
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[10px]">
                internal_note
              </code>
              field. Defaults to all selected — uncheck All to pick specific funnels.
            </p>
          )}
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs">
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
        </div>

        <div>
          <Label>Call Time</Label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetKey(p.key)}
                className={
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition " +
                  (presetKey === p.key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-muted-foreground hover:border-accent/40 hover:text-foreground")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {presetKey === "custom" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-muted-foreground">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </label>
  );
}
