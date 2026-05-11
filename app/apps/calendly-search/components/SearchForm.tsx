"use client";

import { DateFilterMode, PRESETS, PresetKey } from "../lib/types";

type Props = {
  note: string;
  setNote: (v: string) => void;
  dateFilterMode: DateFilterMode;
  setDateFilterMode: (m: DateFilterMode) => void;
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
    note,
    setNote,
    dateFilterMode,
    setDateFilterMode,
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

  const visiblePresets = PRESETS.filter((p) => p.modes.includes(dateFilterMode));
  if (!visiblePresets.some((p) => p.key === presetKey)) {
    // narrow to a sensible default if mode change invalidated the preset
    Promise.resolve().then(() => props.setPresetKey("last7d"));
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-5">
        <div>
          <Label>Internal Note Contains</Label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) onSearch();
            }}
            placeholder="e.g. setter, vip, webinar, affiliate, skool..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div>
          <Label>Filter Date By</Label>
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
            <ToggleButton on={dateFilterMode === "booked"} onClick={() => setDateFilterMode("booked")}>
              Booking Time
            </ToggleButton>
            <ToggleButton on={dateFilterMode === "appointment"} onClick={() => setDateFilterMode("appointment")}>
              Call Time
            </ToggleButton>
          </div>
          <span className="ml-3 text-xs text-muted-foreground">
            {dateFilterMode === "booked"
              ? "When the call was booked (created_at), regardless of when scheduled"
              : "When the call is scheduled to take place (start_time). Future windows enabled."}
          </span>
        </div>

        <div>
          <Label>Date Range</Label>
          <div className="flex flex-wrap items-center gap-2">
            {visiblePresets.map((p) => (
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
            {loading ? "Searching…" : "Search Events"}
          </button>
          {loading ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:border-destructive hover:text-destructive"
            >
              Cancel
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">↵ Enter to run</span>
          )}
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

function ToggleButton({
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
        "rounded-md px-4 py-1.5 text-xs font-medium transition " +
        (on
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
