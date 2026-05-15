import type { KpiStripData } from "@/lib/weekly-report-bq-v2";
import { getResolvedSql, type MetricKey, type SqlCtx } from "@/lib/dev-sql";
import { TIP } from "@/lib/metric-tips";
import { SqlInfoButton } from "./SqlInfoButton";
import styles from "./report.module.css";

const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "N/A" : `${(frac * 100).toFixed(digits)}%`;
const fmtX = (n: number | null, digits = 2) =>
  n == null ? "N/A" : `${n.toFixed(digits)}×`;
const fmtUsd = (n: number | null) =>
  n == null
    ? "N/A"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function PersistentKpiStrip({
  data,
  devMode = false,
  sqlCtx,
}: {
  data: KpiStripData;
  devMode?: boolean;
  sqlCtx?: SqlCtx;
}) {
  // Each card: value renders as the canonical metric formatting; N/A
  // values fall back to .kpiValueNa per spec §22.
  const card = (
    kind: "webinar" | "company",
    label: string,
    value: string,
    isNa: boolean,
    meta: string,
    tooltip: string,
    metricKey: MetricKey,
  ) => (
    <Card
      kind={kind}
      label={label}
      value={value}
      isNa={isNa}
      meta={meta}
      tooltip={tooltip}
      sqlInfo={devMode && sqlCtx ? getResolvedSql(metricKey, sqlCtx) : null}
    />
  );

  return (
    <div className={styles.kpiStrip}>
      {card("webinar", "Avg Webinar Show Rate", fmtPct(data.avgWebinarShowRate), data.avgWebinarShowRate == null, "Target 24%", TIP.avgWebinarShowRate, "avgWebinarShowRate")}
      {card("webinar", "% Tier 1 Leads", fmtPct(data.pctTierOneLeads), data.pctTierOneLeads == null, "Awaiting mart fields", TIP.pctTierOneLeads, "pctTierOneLeads")}

      <div className={styles.kpiDivider} aria-hidden="true" />

      {card("company", "Blended Cash ROAS", fmtX(data.blendedCashRoas), data.blendedCashRoas == null, "Target 4×", TIP.blendedCashRoas, "blendedCashRoas")}
      {card("company", "CPL Blended", fmtUsd(data.cplBlended), data.cplBlended == null, "Target <$7", TIP.cplBlended, "cplBlended")}
      {card("company", "Cash / Booked Call (DPC)", fmtUsd(data.cashPerBookedCall), data.cashPerBookedCall == null, "Sergio's KPI", TIP.cashPerBookedCall, "cashPerBookedCall")}
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
  sqlInfo,
}: {
  kind: "webinar" | "company";
  label: string;
  value: string;
  isNa: boolean;
  meta: string;
  tooltip: string;
  sqlInfo?: import("@/lib/dev-sql").ResolvedMetricSql | null;
}) {
  const kindCls = kind === "webinar" ? styles.kpiWebinar : styles.kpiCompany;
  return (
    <div className={`${styles.kpiCard} ${kindCls}`}>
      <div className={styles.kpiLabel}>
        <span className={styles.tip} data-tip={tooltip} style={{ cursor: "help" }}>
          {label}
        </span>
        {sqlInfo ? <SqlInfoButton resolved={sqlInfo} /> : null}
      </div>
      <div className={`${styles.kpiValue} ${isNa ? styles.kpiValueNa : ""}`}>{value}</div>
      <div className={styles.kpiMeta}>{meta}</div>
    </div>
  );
}
