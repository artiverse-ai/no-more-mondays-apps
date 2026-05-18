import type {
  SectionAData,
  SectionATab3Data,
  SectionBData,
  SectionCData,
} from "@/lib/weekly-report-bq-v2";
import { paceLight } from "@/lib/forecast";
import { salesWeekLabel } from "@/lib/window-labels";
import styles from "./report.module.css";

const fmtInt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtUsd = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "—" : `${(frac * 100).toFixed(digits)}%`;

// Forecast bundle shape (mirrors getForecastBundleForWindow return type — kept
// inline to avoid importing the server-only lib type tree from a client-safe file).
export type ForecastBundle = {
  forecastId: string | null;
  ad_spend: number | null;
  cash: number | null;
  revenue: number | null;
  deals_closed: number | null;
  calls_booked: number | null;
  calls_held: number | null;
  show_rate: number | null;
  close_rate: number | null;
  aov_cash: number | null;
} | null;

// Headline strip — the 4 metrics the CEO checks first on every report.
// All 4 cards are scoped to the SALES WEEK (Sun-Sat ET). A header bar above
// the cards spells out the exact date range so the CEO never has to guess.
// AOV uses CLOSER-attributed cash (int_calls_enriched), not Fanbasis money-in.
// Fanbasis AOV (Fanbasis cash / mart deals) mixes denominators and is
// meaningless — per Shahriar 2026-05-18.
export type TopMetricsProps = {
  sectionA: SectionAData;
  sectionATab3: SectionATab3Data;       // closer-attributed money — authoritative for AOV
  sectionB: SectionBData;
  sectionC: SectionCData;
  forecast?: ForecastBundle;
  kpiStart: string;                      // sales-week start (Sun) for the header label
  kpiEnd: string;                        // sales-week end (Sat)
};

export function TopMetrics({ sectionA, sectionATab3, sectionB, sectionC, forecast, kpiStart, kpiEnd }: TopMetricsProps) {
  // Volumes use pct of target. Rates compare the absolute delta and color
  // green if actual ≥ target, orange if within 90%, red below.
  const callsBookedActual = sectionB.totalCallsBooked;
  const showRateActual = sectionC.showRate;
  // Use closeRateShows (deals / shows) — its denominator matches the CSV
  // projection model's "deals / held" basis, so target comparisons are
  // apples-to-apples. SectionC.closeRate (deals / qualified_shows, CQ basis)
  // is a stricter ratio without a CSV-side equivalent target.
  const closeRateActual = sectionC.closeRateShows;
  // Closer-attributed AOV (int_calls_enriched cash / deals — same source,
  // same denominator basis). Tracks "what closers booked this week".
  const aovActual = sectionATab3.aov;
  // Mark unused so TS doesn't complain (kept in props for future Fanbasis
  // comparison cards / debugging).
  void sectionA;

  const callsChip = forecast?.calls_booked != null
    ? buildVolumeChip(callsBookedActual, forecast.calls_booked, (v) => fmtInt(v))
    : null;
  const showRateChip = forecast?.show_rate != null
    ? buildRateChip(showRateActual, forecast.show_rate, (v) => fmtPct(v))
    : null;
  const closeRateChip = forecast?.close_rate != null
    ? buildRateChip(closeRateActual, forecast.close_rate, (v) => fmtPct(v))
    : null;
  const aovChip = forecast?.aov_cash != null
    ? buildRateChip(aovActual, forecast.aov_cash, (v) => fmtUsd(v))
    : null;

  return (
    <>
      <div className={styles.topMetricsScope}>
        <span aria-hidden>📅</span>
        <span>{salesWeekLabel(kpiStart, kpiEnd)}</span>
      </div>
      <section className={styles.topMetricsStrip}>
        <TopCard
          emoji="📞"
          label="Calls Booked"
          value={fmtInt(callsBookedActual)}
          sub={
            sectionB.totalCallsBookedActive != null
              ? `Active: ${fmtInt(sectionB.totalCallsBookedActive)}`
              : "stg_calendly · dedup by email"
          }
          chip={callsChip}
        />
        <TopCard
          emoji="📈"
          label="Show Rate"
          value={fmtPct(showRateActual)}
          sub="Shows / Pros (SQ)"
          chip={showRateChip}
        />
        <TopCard
          emoji="🎯"
          label="Close Rate"
          value={fmtPct(closeRateActual)}
          sub="Deals / Shows"
          chip={closeRateChip}
        />
        <TopCard
          emoji="💵"
          label="AOV"
          value={fmtUsd(aovActual)}
          sub="Closer cash / Deals"
          chip={aovChip}
        />
      </section>
    </>
  );
}

type Chip = { text: string; light: "green" | "orange" | "red" | "unknown" };

function buildVolumeChip(
  actual: number | null,
  target: number,
  fmt: (v: number) => string,
): Chip {
  const { pct, light } = paceLight(actual, target);
  if (pct == null) return { text: `vs ${fmt(target)} target`, light: "unknown" };
  return { text: `${(pct * 100).toFixed(0)}% of ${fmt(target)}`, light };
}

function buildRateChip(
  actual: number | null,
  target: number,
  fmt: (v: number) => string,
): Chip {
  if (actual == null) return { text: `target ${fmt(target)}`, light: "unknown" };
  if (actual >= target) return { text: `target ${fmt(target)} ✓`, light: "green" };
  const pct = actual / target;
  return {
    text: `target ${fmt(target)}`,
    light: pct >= 0.9 ? "orange" : "red",
  };
}

function chipClass(light: Chip["light"]): string {
  switch (light) {
    case "green":   return styles.topMetricChipGreen;
    case "orange":  return styles.topMetricChipOrange;
    case "red":     return styles.topMetricChipRed;
    default:        return styles.topMetricChipNeutral;
  }
}

function TopCard({
  emoji,
  label,
  value,
  sub,
  chip,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
  chip: Chip | null;
}) {
  return (
    <div className={styles.topMetricCard}>
      <div className={styles.topMetricLbl}>
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </div>
      <div className={styles.topMetricVal}>{value}</div>
      {chip && <div className={`${styles.topMetricChip} ${chipClass(chip.light)}`}>{chip.text}</div>}
      <div className={styles.topMetricSub}>{sub}</div>
    </div>
  );
}
