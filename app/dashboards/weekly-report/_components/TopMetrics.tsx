import type { SectionAData, SectionBData, SectionCData } from "@/lib/weekly-report-bq-v2";
import styles from "./report.module.css";

const fmtInt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtUsd = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "—" : `${(frac * 100).toFixed(digits)}%`;

// Headline strip — the 4 metrics the CEO checks first on every report.
// Pulled from the same Section A/B/C data the deeper tabs render, so the
// numbers always match. Forecast-target chips (vs goal) will hook in here
// once nmm_calendar.forecast_targets ships.
export type TopMetricsProps = {
  sectionA: SectionAData;
  sectionB: SectionBData;
  sectionC: SectionCData;
};

export function TopMetrics({ sectionA, sectionB, sectionC }: TopMetricsProps) {
  return (
    <section className={styles.topMetricsStrip}>
      <TopCard
        emoji="📞"
        label="Calls Booked"
        value={fmtInt(sectionB.totalCallsBooked)}
        sub={
          sectionB.totalCallsBookedActive != null
            ? `Active: ${fmtInt(sectionB.totalCallsBookedActive)}`
            : "stg_calendly · dedup by email"
        }
      />
      <TopCard
        emoji="📈"
        label="Show Rate"
        value={fmtPct(sectionC.showRate)}
        sub="Shows / Pros (SQ)"
      />
      <TopCard
        emoji="🎯"
        label="Close Rate"
        value={fmtPct(sectionC.closeRate)}
        sub="Deals / Qualified Shows"
      />
      <TopCard
        emoji="💵"
        label="AOV"
        value={fmtUsd(sectionA.aov)}
        sub="Fanbasis cash / Deals"
      />
    </section>
  );
}

function TopCard({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={styles.topMetricCard}>
      <div className={styles.topMetricLbl}>
        <span aria-hidden>{emoji}</span>
        <span>{label}</span>
      </div>
      <div className={styles.topMetricVal}>{value}</div>
      <div className={styles.topMetricSub}>{sub}</div>
    </div>
  );
}
