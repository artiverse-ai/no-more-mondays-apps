"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Proposed = {
  slug: string;
  runOn: string;
  weekStart: string;
  weekEnd: string;
  reportType: "weekly_recap" | "midweek_check";
  weekLabel: string;
  badge: string;
};

type GetResponse =
  | { status: "exists"; proposed: Proposed; existingSlug: string }
  | { status: "ready"; proposed: Proposed; availability: { webinars: number; calls: number; missing: string[] } }
  | { status: "missing_data"; proposed: Proposed; availability: { webinars: number; calls: number; missing: string[] } };

export function CreateNextSnapshotButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "checking" | "creating">("idle");
  const [result, setResult] = useState<GetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setError(null);
  };

  const check = async () => {
    setStatus("checking");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/weekly-reports/next", { cache: "no-store" });
      const data: GetResponse & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  };

  const create = async () => {
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/weekly-reports/next", { method: "POST" });
      const data: { slug?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/dashboards/weekly-report/${data.slug}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    }
  };

  // Initial state — single button.
  if (!result && !error) {
    return (
      <button
        type="button"
        onClick={() => void check()}
        disabled={status !== "idle"}
        className="shrink-0 rounded-lg border border-accent bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "checking" ? "Checking…" : "+ Create next snapshot"}
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 text-sm shadow-sm">
      {error ? (
        <div className="space-y-2">
          <div className="text-rose-700">Error: {error}</div>
          <button type="button" onClick={reset} className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
            ← Try again
          </button>
        </div>
      ) : result?.status === "exists" ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Already created</div>
            <p className="mt-1 text-sm">
              The next due snapshot (<code className="font-mono">{result.proposed.slug}</code> ·{" "}
              {result.proposed.reportType === "weekly_recap" ? "Weekly recap" : "Midweek check"}) already exists.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/dashboards/weekly-report/${result.existingSlug}`}
              className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-accent hover:bg-accent/20"
            >
              Open →
            </a>
            <button type="button" onClick={reset} className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        </div>
      ) : result?.status === "missing_data" ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-rose-700">Not ready yet</div>
            <p className="mt-1 text-sm">
              Proposed: <code className="font-mono">{result.proposed.slug}</code> ·{" "}
              {result.proposed.weekLabel}
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              <li>
                Webinar rows in <code className="font-mono">mart_webinar_events</code>:{" "}
                <span className={result.availability.webinars === 0 ? "text-rose-700" : ""}>
                  {result.availability.webinars}
                </span>
              </li>
              <li>
                Call rows in <code className="font-mono">int_calls_enriched</code>:{" "}
                <span className={result.availability.calls === 0 ? "text-rose-700" : ""}>
                  {result.availability.calls}
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Missing: <strong>{result.availability.missing.join(", ")}</strong>. Wait for the dbt pipeline to finish, then try again.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void check()} className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-accent hover:bg-accent/10">
              Re-check
            </button>
            <button type="button" onClick={reset} className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      ) : result?.status === "ready" ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">Ready to create</div>
            <div className="mt-1 space-y-1 text-sm">
              <div>
                <strong>{result.proposed.reportType === "weekly_recap" ? "Weekly recap" : "Midweek check"}</strong>{" "}
                · <code className="font-mono">{result.proposed.slug}</code>
              </div>
              <div className="text-muted-foreground">{result.proposed.weekLabel}</div>
              <div className="text-xs text-muted-foreground">
                {result.availability.webinars} webinar row{result.availability.webinars === 1 ? "" : "s"} ·{" "}
                {result.availability.calls.toLocaleString()} call row{result.availability.calls === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={status === "creating"}
              className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "creating" ? "Creating…" : "Create snapshot"}
            </button>
            <button type="button" onClick={reset} disabled={status === "creating"} className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            The VM cron will pick it up within ~60 seconds and generate insights with Claude.
          </p>
        </div>
      ) : null}
    </div>
  );
}
