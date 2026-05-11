"use client";

import { SearchProgress } from "../lib/types";

export function ProgressStrip({ progress }: { progress: SearchProgress }) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">{progress.message}</span>
        <div className="flex items-center gap-3">
          {progress.detail ? (
            <span className="max-w-[280px] truncate text-xs text-muted-foreground">{progress.detail}</span>
          ) : null}
          <span className="font-mono text-xs font-medium text-accent">{progress.pct}%</span>
        </div>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        {progress.apiCalls} API calls · {progress.elapsedSec.toFixed(1)}s elapsed · 8 parallel
      </p>
    </section>
  );
}
