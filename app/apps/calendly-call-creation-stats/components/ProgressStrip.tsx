"use client";

import { SearchProgress } from "../lib/types";

type Props = {
  /** Detailed progress from the search pipeline. Null = initial state. */
  progress: SearchProgress | null;
  /** Shown when progress is null (e.g. while options are loading). */
  initialMessage?: string;
};

export function ProgressStrip({ progress, initialMessage }: Props) {
  const isInitial = !progress;
  const message = progress?.message ?? initialMessage ?? "Loading…";
  const pct = progress?.pct ?? null;

  return (
    <section className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Spinner />
          <span className="text-sm font-medium text-foreground">{message}</span>
        </div>
        <div className="flex items-center gap-3">
          {progress?.detail ? (
            <span className="max-w-[280px] truncate text-xs text-muted-foreground">
              {progress.detail}
            </span>
          ) : null}
          {pct !== null ? (
            <span className="font-mono text-xs font-medium text-accent">{pct}%</span>
          ) : null}
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        {pct !== null ? (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="indeterminate-bar h-full rounded-full bg-accent/60" />
        )}
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        Hang tight — usually 60–120 seconds (Calendly API is the bottleneck).
        {progress ? (
          <>
            {" "}
            <span className="text-foreground/70">
              {progress.apiCalls} API calls · {progress.elapsedSec.toFixed(1)}s elapsed
            </span>
          </>
        ) : isInitial ? (
          <> Pulling fresh data from Calendly.</>
        ) : null}
      </p>
      <style>{`
        @keyframes nmm-indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .indeterminate-bar {
          width: 40%;
          animation: nmm-indeterminate 1.4s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
    />
  );
}
