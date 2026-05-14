"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SnapshotRow({
  slug,
  runOn,
  reportType,
  weekStart,
  weekEnd,
}: {
  slug: string;
  runOn: string;
  reportType: "weekly_recap" | "midweek_check";
  weekStart: string;
  weekEnd: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!confirm(`Delete snapshot "${slug}"? This soft-deletes the row — insights and posted solutions stay.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-reports/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const d: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <div>
        <div className="font-medium">
          {runOn} · {reportType === "weekly_recap" ? "Weekly recap" : "Midweek check"}
        </div>
        <div className="text-xs text-muted-foreground">
          slug=<code className="font-mono">{slug}</code> · week {weekStart} → {weekEnd}
        </div>
        {error ? <div className="mt-1 text-xs text-rose-600">{error}</div> : null}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboards/weekly-report/${slug}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-accent hover:underline"
        >
          Open →
        </Link>
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="rounded-md border border-rose-500/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
