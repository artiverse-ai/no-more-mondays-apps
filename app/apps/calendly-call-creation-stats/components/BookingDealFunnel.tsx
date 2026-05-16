"use client";

import { Row } from "../lib/types";
import type { EnrichmentMeta } from "../lib/enrich";
import { BqEnrichInfoButton } from "./BqEnrichInfoButton";

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// The CEO scan: of the bookings created in this window, how many are
// going to convert? Bookings → Held → Deals → Cash.
//
// Held / Deals / Cash depend on BQ enrichment. If no rows have been
// enriched yet, we render dashes for those columns and show a small
// "Enriching..." badge in the corner. The (i) badge next to the heading
// pops the resolved BQ SQL so you can debug a mismatch.
export function BookingDealFunnel({
  rows,
  enrichMeta,
}: {
  rows: Row[];
  enrichMeta: EnrichmentMeta | null;
}) {
  const total = rows.length;
  const future = rows.filter((r) => r.callStatus === "future").length;
  const canceled = rows.filter((r) => r.callStatus === "canceled").length;
  // Eligible for "Held" = past, non-canceled bookings. Future calls can't
  // be held yet; canceled ones never had a chance. This matches the show-
  // rate denominator used in the Sales / Weekly Report dashboards.
  const eligibleForShow = total - future - canceled;
  const held = rows.filter((r) => r.wasHeld === true).length;
  const deals = rows.filter((r) => r.isDeal === true).length;
  const cash = rows.reduce((sum, r) => sum + (r.cashCollected ?? 0), 0);
  // If nothing has been enriched yet, indicate we're waiting.
  const enrichedAny = rows.some((r) => r.wasHeld !== null || r.isDeal !== null || r.cashCollected !== null);

  const pct = (n: number, base: number) => (base === 0 ? "—" : `${Math.round((n / base) * 100)}%`);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Booking → Cash funnel
          <BqEnrichInfoButton meta={enrichMeta} />
        </h3>
        {enrichMeta?.error ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-rose-700">
            ⚠ Enrichment failed — click (i)
          </span>
        ) : !enrichedAny ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {enrichMeta ? `0 of ${enrichMeta.total} matched in BQ — click (i)` : "Awaiting BQ enrichment…"}
          </span>
        ) : enrichMeta ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {enrichMeta.matched}/{enrichMeta.total} BQ-matched
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FunnelCard
          label="Bookings created"
          value={String(total)}
          sub={`${future} future · ${canceled} canceled · ${eligibleForShow} eligible`}
          tone="accent"
        />
        <FunnelCard
          label="Held"
          value={enrichedAny ? String(held) : "—"}
          sub={enrichedAny ? `${pct(held, eligibleForShow)} show rate (of ${eligibleForShow} eligible)` : ""}
          tone="emerald"
        />
        <FunnelCard
          label="Deals closed"
          value={enrichedAny ? String(deals) : "—"}
          sub={enrichedAny ? `${pct(deals, held)} close rate (of ${held} held)` : ""}
          tone="violet"
        />
        <FunnelCard
          label="Cash collected"
          value={enrichedAny ? fmtUsd(cash) : "—"}
          sub={enrichedAny && deals > 0 ? `${fmtUsd(cash / deals)} / deal` : ""}
          tone="amber"
        />
      </div>
    </section>
  );
}

function FunnelCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "emerald" | "violet" | "amber";
}) {
  const toneClass: Record<typeof tone, string> = {
    accent: "text-accent",
    emerald: "text-emerald-600",
    violet: "text-violet-600",
    amber: "text-amber-600",
  };
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
