import type { KpiStripData } from "@/lib/weekly-report-bq-v2";
import { getResolvedSql, type MetricKey, type SqlCtx } from "@/lib/dev-sql";
import { TIP } from "@/lib/metric-tips";
import {
  getTrafficLight,
  trafficLightColor,
  type ThresholdKey,
} from "@/lib/metric-thresholds";
import { fmtDateRange, fmtShortDate } from "@/lib/window-labels";
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
  // Per-card window labels — each metric's time scope shown directly below
  // its threshold so the user always knows which date range produced the
  // number. Sales/Marketing/Last-3 windows differ across cards.
  const salesWeek = sqlCtx ? fmtDateRange(sqlCtx.kpiStart, sqlCtx.kpiEnd) : "—";
  const marketingWeek = sqlCtx ? fmtDateRange(sqlCtx.mwStart, sqlCtx.mwEnd) : "—";
  const lastThree = sqlCtx ? `through ${fmtShortDate(sqlCtx.latestWebinarDate)}` : "—";

  // Each card: value renders as the canonical metric formatting; N/A
  // values fall back to .kpiValueNa per spec §22.
  const card = (
    kind: "webinar" | "company",
    label: string,
    value: string,
    isNa: boolean,
    meta: string,
    scope: string,
    tooltip: string,
    metricKey: MetricKey,
    trafficKey?: ThresholdKey,
    rawValue?: number | null,
  ) => (
    <Card
      kind={kind}
      label={label}
      value={value}
      isNa={isNa}
      meta={meta}
      scope={scope}
      tooltip={tooltip}
      sqlInfo={devMode && sqlCtx ? getResolvedSql(metricKey, sqlCtx) : null}
      trafficKey={trafficKey}
      rawValue={rawValue}
    />
  );

  return (
    <div className={styles.kpiStrip}>
      {card("webinar", "Avg Webinar Show Rate", fmtPct(data.avgWebinarShowRate), data.avgWebinarShowRate == null, "≥25% green · 20–25% orange · <20% red", `Last 3 webinars · ${lastThree}`, TIP.avgWebinarShowRate, "avgWebinarShowRate", "webinarShowUpRate", data.avgWebinarShowRate)}
      {card("webinar", "% Tier 1 Leads", fmtPct(data.pctTierOneLeads), data.pctTierOneLeads == null, "Awaiting mart fields", `Marketing wk · ${marketingWeek}`, TIP.pctTierOneLeads, "pctTierOneLeads")}

      <div className={styles.kpiDivider} aria-hidden="true" />

      {card("company", "Blended Cash ROAS", fmtX(data.blendedCashRoas), data.blendedCashRoas == null, "≥3× green · 2–3× orange · <2× red", `Sales wk · ${salesWeek}`, TIP.blendedCashRoas, "blendedCashRoas", "roas", data.blendedCashRoas)}
      {card("company", "CPL Blended", fmtUsd(data.cplBlended), data.cplBlended == null, "Target <$7", `Sales wk · ${salesWeek}`, TIP.cplBlended, "cplBlended")}
      {card("company", "Cash / Booked Call (DPC)", fmtUsd(data.cashPerBookedCall), data.cashPerBookedCall == null, "Sergio's KPI", `Sales wk · ${salesWeek}`, TIP.cashPerBookedCall, "cashPerBookedCall")}
    </div>
  );
}

function Card({
  kind,
  label,
  value,
  isNa,
  meta,
  scope,
  tooltip,
  sqlInfo,
  trafficKey,
  rawValue,
}: {
  kind: "webinar" | "company";
  label: string;
  value: string;
  isNa: boolean;
  meta: string;
  scope: string;
  tooltip: string;
  sqlInfo?: import("@/lib/dev-sql").ResolvedMetricSql | null;
  trafficKey?: ThresholdKey;
  rawValue?: number | null;
}) {
  const kindCls = kind === "webinar" ? styles.kpiWebinar : styles.kpiCompany;
  const light = trafficKey ? getTrafficLight(rawValue, trafficKey) : "neutral";
  const color = trafficLightColor(light);
  return (
    <div className={`${styles.kpiCard} ${kindCls}`}>
      <div className={styles.kpiLabel}>
        <span className={styles.tip} data-tip={tooltip} style={{ cursor: "help" }}>
          {label}
        </span>
        {sqlInfo ? <SqlInfoButton resolved={sqlInfo} /> : null}
      </div>
      <div className={`${styles.kpiValue} ${isNa ? styles.kpiValueNa : ""}`} style={color ? { color } : undefined}>{value}</div>
      <div className={styles.kpiMeta}>{meta}</div>
      <div className={styles.kpiScope}>{scope}</div>
    </div>
  );
}
