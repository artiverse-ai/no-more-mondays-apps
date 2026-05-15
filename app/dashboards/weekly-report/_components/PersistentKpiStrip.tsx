import type { KpiStripData } from "@/lib/weekly-report-bq-v2";
import styles from "./report.module.css";

const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "N/A" : `${(frac * 100).toFixed(digits)}%`;
const fmtX = (n: number | null, digits = 2) =>
  n == null ? "N/A" : `${n.toFixed(digits)}×`;
const fmtUsd = (n: number | null) =>
  n == null
    ? "N/A"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PersistentKpiStrip({ data }: { data: KpiStripData }) {
  // Each card: value renders as the canonical metric formatting; N/A
  // values fall back to .kpiValueNa per spec §22.
  return (
    <div className={styles.kpiStrip}>
      <Card
        kind="webinar"
        label="Avg Webinar Show Rate"
        value={fmtPct(data.avgWebinarShowRate)}
        isNa={data.avgWebinarShowRate == null}
        meta="Target 24%"
        tooltip="SUM(unique_attendees) / SUM(total_registrants) across Sun + Wed webinars in the previous Sun-Sat window. Source: mart_webinar_events."
      />
      <Card
        kind="webinar"
        label="% Tier 1 Leads"
        value={fmtPct(data.pctTierOneLeads)}
        isNa={data.pctTierOneLeads == null}
        meta="Awaiting mart fields"
        tooltip="tier_one_submissions / form_submissions. Field not yet ingested into mart_webinar_events."
      />

      <div className={styles.kpiDivider} aria-hidden="true" />

      <Card
        kind="company"
        label="Blended Cash ROAS"
        value={fmtX(data.blendedCashRoas)}
        isNa={data.blendedCashRoas == null}
        meta="Target 4×"
        tooltip="Fanbasis cash / total Meta ad spend (ALL campaigns) over the previous Sun-Sat."
      />
      <Card
        kind="company"
        label="CPL Blended"
        value={fmtUsd(data.cplBlended)}
        isNa={data.cplBlended == null}
        meta="Target <$7"
        tooltip="Blended cost-per-lead. Denominator field not yet decided (Open Item #2)."
      />
      <Card
        kind="company"
        label="Cash / Booked Call (DPC)"
        value={fmtUsd(data.cashPerBookedCall)}
        isNa={data.cashPerBookedCall == null}
        meta="Sergio's KPI"
        tooltip="Fanbasis cash / total_calls_booked. Calendly strategy-call grain, deduped by invitee_email."
      />
    </div>
  );
}

function Card({
  kind,
  label,
  value,
  isNa,
  meta,
  tooltip,
}: {
  kind: "webinar" | "company";
  label: string;
  value: string;
  isNa: boolean;
  meta: string;
  tooltip: string;
}) {
  const kindCls = kind === "webinar" ? styles.kpiWebinar : styles.kpiCompany;
  return (
    <div className={`${styles.kpiCard} ${kindCls}`}>
      <div className={styles.kpiLabel}>
        <span className={styles.tip} title={tooltip}>
          {label}
        </span>
      </div>
      <div className={`${styles.kpiValue} ${isNa ? styles.kpiValueNa : ""}`}>{value}</div>
      <div className={styles.kpiMeta}>{meta}</div>
    </div>
  );
}
