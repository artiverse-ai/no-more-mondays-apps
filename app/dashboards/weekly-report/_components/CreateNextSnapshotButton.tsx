"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Proposal = {
  slug: string;
  runOn: string;
  weekStart: string;
  weekEnd: string;
  reportType: "weekly_recap" | "midweek_check";
  weekLabel: string;
  badge: string;
  latestWebinar: string;
  existing: boolean;
  dataReady: boolean;
  availability: { webinars: number; calls: number; missing: string[] };
};

// Server-component-facing shape (matches what the index page builds in
// its SSR preload). Re-exported so the parent can type its prop.
export type InitialProposal = Proposal;

const REPORT_LABEL: Record<Proposal["reportType"], string> = {
  weekly_recap: "Weekly recap",
  midweek_check: "Midweek check",
};

function fmtDayDate(iso: string): string {
  // "Thu May 14, 2026"
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function isFutureDate(iso: string): boolean {
  const d = new Date(iso + "T00:00:00Z");
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return d > todayUtc;
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export function CreateNextSnapshotButton({ initialProposals = [] }: { initialProposals?: InitialProposal[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(
    initialProposals.length > 0 ? initialProposals : null,
  );
  const [selectedRunOn, setSelectedRunOn] = useState<string | null>(
    initialProposals[0]?.runOn ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // Fall back to a client-side fetch only if SSR preload didn't ship.
  useEffect(() => {
    if (!open || proposals) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/weekly-reports/proposals", { cache: "no-store" });
        const data: { proposals?: Proposal[]; error?: string } = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setProposals(data.proposals ?? []);
        setSelectedRunOn(data.proposals?.[0]?.runOn ?? null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, proposals]);

  const selected = useMemo(
    () => proposals?.find((p) => p.runOn === selectedRunOn) ?? null,
    [proposals, selectedRunOn],
  );

  const reset = () => {
    setOpen(false);
    setProposals(null);
    setSelectedRunOn(null);
    setError(null);
  };

  const create = async () => {
    if (!selected || selected.existing || !selected.dataReady) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-reports/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runOn: selected.runOn }),
      });
      const data: { slug?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/dashboards/weekly-report/${data.slug}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-accent bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-accent transition hover:bg-accent/20"
      >
        + Create snapshot
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 text-sm shadow-sm">
      {loading ? (
        <div className="text-muted-foreground">Loading available dates…</div>
      ) : error && !proposals ? (
        <div className="space-y-2">
          <div className="text-rose-700">Error: {error}</div>
          <button type="button" onClick={reset} className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
            ← Cancel
          </button>
        </div>
      ) : !proposals || proposals.length === 0 ? (
        <div className="space-y-2">
          <div className="text-muted-foreground">No Mon/Thu dates available in the last 12 weeks.</div>
          <button type="button" onClick={reset} className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
            ← Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="snapshot-date" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pick a date (next 2 upcoming + last 12 weeks)
            </label>
            <select
              id="snapshot-date"
              value={selectedRunOn ?? ""}
              onChange={(e) => setSelectedRunOn(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {proposals.map((p) => {
                const future = isFutureDate(p.runOn);
                const statusTag = p.existing
                  ? "already exists"
                  : p.dataReady
                  ? "ready"
                  : `missing ${p.availability.missing.join(" + ")}`;
                const prefix = future ? "⏳ " : "";
                return (
                  <option key={p.runOn} value={p.runOn}>
                    {prefix}{fmtDayDate(p.runOn)} · {REPORT_LABEL[p.reportType]} — {statusTag}
                  </option>
                );
              })}
            </select>
          </div>

          {selected ? (
            <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-xs">
              <div className="font-mono text-sm">{selected.slug}</div>
              <div className="text-muted-foreground">
                {REPORT_LABEL[selected.reportType]} · Week {fmtRange(selected.weekStart, selected.weekEnd)}
              </div>
              <div className="text-muted-foreground">Latest webinar: {selected.latestWebinar}</div>
              <div className="text-muted-foreground">
                BQ data:{" "}
                <span className={selected.availability.webinars === 0 ? "text-rose-700" : ""}>
                  {selected.availability.webinars} webinars
                </span>{" "}
                ·{" "}
                <span className={selected.availability.calls === 0 ? "text-rose-700" : ""}>
                  {selected.availability.calls.toLocaleString()} calls
                </span>
              </div>
              {selected.existing ? (
                <div className="text-amber-700">Snapshot already exists.</div>
              ) : !selected.dataReady ? (
                <div className="text-rose-700">
                  Cannot create — missing <strong>{selected.availability.missing.join(", ")}</strong> in BQ for this window.
                  {isFutureDate(selected.runOn) ? " The button will enable as soon as the cycle's data lands." : ""}
                </div>
              ) : (
                <div className="text-emerald-700">
                  Ready to create{isFutureDate(selected.runOn) ? " — BQ already has the window's data even though the run date is upcoming." : ""}.
                </div>
              )}
            </div>
          ) : null}

          {error ? <div className="text-xs text-rose-700">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            {selected?.existing ? (
              <a
                href={`/dashboards/weekly-report/${selected.slug}`}
                className="rounded-md border border-accent bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-accent hover:bg-accent/20"
              >
                Open →
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void create()}
                disabled={!selected || !selected.dataReady || creating}
                title={
                  !selected
                    ? "Select a date first"
                    : !selected.dataReady
                    ? `BQ data not ready — missing ${selected.availability.missing.join(", ")} for ${fmtRange(selected.weekStart, selected.weekEnd)}. As soon as BQ has webinars + calls in this window, the button enables.`
                    : ""
                }
                className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create snapshot"}
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={creating}
              className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Only past Mon/Thu dates can be created. After creation, the VM cron picks it up within ~60s and generates AI insights.
          </p>
        </div>
      )}
    </div>
  );
}
