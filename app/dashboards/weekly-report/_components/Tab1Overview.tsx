import type { SectionAData, SectionATab3Data, SectionBData, SectionCData } from "@/lib/weekly-report-bq-v2";
import { getResolvedSql, type MetricKey, type SqlCtx } from "@/lib/dev-sql";
import { TIP } from "@/lib/metric-tips";
import {
  getTrafficLight,
  trafficLightColor,
  type ThresholdKey,
} from "@/lib/metric-thresholds";
import { SqlInfoButton } from "./SqlInfoButton";
import styles from "./report.module.css";

const fmtInt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtUsd = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtUsd2 = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "—" : `${(frac * 100).toFixed(digits)}%`;
const fmtX = (n: number | null, digits = 2) => (n == null ? "—" : `${n.toFixed(digits)}×`);
const fmtDays = (n: number | null, digits = 1) => (n == null ? "—" : `${n.toFixed(digits)}d`);

export type Tab1OverviewProps = {
  weekLabel: string;
  sectionA: SectionAData;
  sectionATab3: SectionATab3Data;   // closer-attributed money — authoritative for AOV + side-by-side "Closer Cash" card
  sectionB: SectionBData;
  sectionC: SectionCData;
  devMode?: boolean;
  sqlCtx?: SqlCtx;
};

export function Tab1Overview({ weekLabel, sectionA, sectionATab3, sectionB, sectionC, devMode = false, sqlCtx }: Tab1OverviewProps) {
  const showSql = devMode && sqlCtx;
  const sqlFor = (k: MetricKey) => (showSql ? getResolvedSql(k, sqlCtx) : null);
  return (
    <>
      <SectionA data={sectionA} sectionATab3={sectionATab3} weekLabel={weekLabel} sqlFor={sqlFor} />
      <SectionB data={sectionB} sqlFor={sqlFor} />
      <SectionC data={sectionC} sqlFor={sqlFor} />
      <SectionD />
    </>
  );
}

type SqlForFn = (k: MetricKey) => import("@/lib/dev-sql").ResolvedMetricSql | null;

// ============================================================================
// SECTION A — Overall Company Performance (10 money cards + 4 cycle cards)
// ============================================================================
function SectionA({ data, sectionATab3, weekLabel, sqlFor }: { data: SectionAData; sectionATab3: SectionATab3Data; weekLabel: string; sqlFor: SqlForFn }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Section A · Overall Company Performance</div>
      <p className={styles.sectionIntro}>
        Company-wide money, deals, and cycle times. {weekLabel}.
      </p>
      <div className={styles.kpiGridMini}>
        <MiniCard emoji="💰" label="Cash Collected" value={fmtUsd(data.cashCollected)} change="Fanbasis + Whop · money-in" tip={TIP.cashCollected} sqlInfo={sqlFor("cashCollected")} />
        <MiniCard
          emoji="🤝"
          label="Closer Cash"
          value={fmtUsd(sectionATab3.cashCollected)}
          change="Deals closed this week"
          tip={"SUM(cash_collected) WHERE is_deal\nWindow: date_closed in sales week (Sun-Sat ET)\nSource: int_calls_enriched (closer-attributed — NEW deals booked, not Fanbasis money-in)"}
        />
        <MiniCard
          emoji="💼"
          label="Revenue (TCV)"
          value={fmtUsd(sectionATab3.revenueTcv)}
          change="Total Contract Value · Closer"
          tip={"SUM(revenue_generated) WHERE is_deal from int_calls_enriched.\nWindow: date_closed in sales week.\nReconciles exactly with mart_high_level_daily.total_revenue_contracted (same upstream column)."}
        />
        <MiniCard emoji="📈" label="ROAS (Cash)" value={fmtX(data.roasCash)} change={target("4×")} tip={TIP.roasCash} sqlInfo={sqlFor("roasCash")} trafficKey="roas" rawValue={data.roasCash} />
        <MiniCard emoji="📈" label="ROAS (TCV)" value={fmtX(data.roasTcv)} change="TCV / Ad Spend" tip={TIP.roasTcv} sqlInfo={sqlFor("roasTcv")} trafficKey="roas" rawValue={data.roasTcv} />
        <MiniCard emoji="📣" label="Ad Spend (Blended)" value={fmtUsd(data.adSpendBlended)} change="All Meta campaigns" tip={TIP.adSpendBlended} sqlInfo={sqlFor("adSpendBlended")} />
        <MiniCard
          emoji="🤝"
          label="Deals Closed"
          value={fmtInt(sectionATab3.dealsClosed)}
          change="Closer-attributed"
          tip={"COUNT(DISTINCT prospect WHERE is_deal) from int_calls_enriched, date_closed in sales week.\nSame source as Closer Cash + AOV — all deal-derived metrics use the closer source for consistency."}
        />
        <MiniCard
          emoji="💵"
          label="AOV"
          value={fmtUsd(sectionATab3.aov)}
          change="Closer cash / deals"
          tip={"SUM(cash_collected) / COUNT deals — both from int_calls_enriched (same denominator basis).\nWindow: date_closed in sales week.\nFanbasis-cash / mart-deals would mix sources and is meaningless — never use that."}
        />
        <MiniCard
          emoji="📦"
          label="ACV"
          value={fmtUsd(sectionATab3.acv)}
          change="Closer TCV / deals"
          tip={"SUM(revenue_generated) / COUNT deals — both from int_calls_enriched.\nWindow: date_closed in sales week."}
        />
        <MiniCard
          emoji="💸"
          label="PIF Rate"
          value={fmtPct(sectionATab3.pifRate)}
          change="Closer · Paid-In-Full deals"
          tip={"COUNT(is_deal AND is_paid_in_full) / COUNT(is_deal) from int_calls_enriched."}
        />
        <MiniCard
          emoji="📊"
          label="Cash Collection Rate"
          value={fmtPct(sectionATab3.cashCollectionRate)}
          change="Closer cash / TCV"
          tip={"SUM(cash_collected) / SUM(revenue_generated) WHERE is_deal — both from int_calls_enriched.\nWindow: date_closed in sales week."}
        />
      </div>

      <div className={styles.sh} style={{ marginTop: 24 }}>
        Sales Cycle (Booking → Close, in Days)
      </div>
      <div className={styles.kpiGridMini}>
        <MiniCard
          emoji="⏱"
          label="OCC Median"
          value={fmtDays(data.medianBookToCloseOcc)}
          change={`n = ${data.nOcc} on-call closes`}
          tip={TIP.medianBookToCloseOcc}
          sqlInfo={sqlFor("medianBookToCloseOcc")}
        />
        <MiniCard
          emoji="⏱"
          label="OCC Average"
          value={fmtDays(data.avgBookToCloseOcc)}
          change={`Book → Close on call`}
          tip={TIP.avgBookToCloseOcc}
          sqlInfo={sqlFor("avgBookToCloseOcc")}
        />
        <MiniCard
          emoji="⏱"
          label="FUC Median"
          value={fmtDays(data.medianFirstCallToCloseFuc)}
          change={`n = ${data.nFuc} follow-up closes`}
          tip={TIP.medianFirstCallToCloseFuc}
          sqlInfo={sqlFor("medianFirstCallToCloseFuc")}
        />
        <MiniCard
          emoji="⏱"
          label="FUC Average"
          value={fmtDays(data.avgFirstCallToCloseFuc)}
          change={`1st Call → Close`}
          tip={TIP.avgFirstCallToCloseFuc}
          sqlInfo={sqlFor("avgFirstCallToCloseFuc")}
        />
      </div>
    </section>
  );
}

// ============================================================================
// SECTION B — Marketing Efficiency (5 cards)
// ============================================================================
function SectionB({ data, sqlFor }: { data: SectionBData; sqlFor: SqlForFn }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Section B · Marketing Efficiency</div>
      <p className={styles.sectionIntro}>
        How efficiently we turn ad spend into qualified pipeline.
      </p>
      <div className={styles.kpiGridMini}>
        <MiniCard
          emoji="📞"
          label="Total Calls Booked"
          value={fmtInt(data.totalCallsBooked)}
          change={data.totalCallsBookedActive != null ? `Active: ${fmtInt(data.totalCallsBookedActive)}` : ""}
          tip={TIP.totalCallsBooked}
          sqlInfo={sqlFor("totalCallsBooked")}
        />
        <MiniCard
          emoji="📞"
          label="Cost / Booked Call"
          value={fmtUsd2(data.costPerBookedCall)}
          change="Ad Spend / Calls Booked"
          tip={TIP.costPerBookedCall}
          sqlInfo={sqlFor("costPerBookedCall")}
          trafficKey="costPerBookedCall"
          rawValue={data.costPerBookedCall}
        />
        <MiniCard
          emoji="💰"
          label="Cash / Booked Call (DPC)"
          value={fmtUsd2(data.cashPerBookedCall)}
          change="Sergio's KPI"
          tip={TIP.cashPerBookedCall}
          sqlInfo={sqlFor("cashPerBookedCall")}
        />
        <MiniCard
          emoji="📊"
          label="Avg Webinar Show Rate"
          value={fmtPct(data.avgWebinarShowRate)}
          change={target("25%")}
          tip={TIP.avgWebinarShowRate}
          sqlInfo={sqlFor("avgWebinarShowRate")}
          trafficKey="webinarShowUpRate"
          rawValue={data.avgWebinarShowRate}
        />
        <MiniCard
          emoji="📈"
          label="CPL Blended"
          value={fmtUsd2(data.cplBlended)}
          change={target("<$7")}
          tip={TIP.cplBlended}
          sqlInfo={sqlFor("cplBlended")}
        />
      </div>
    </section>
  );
}

// ============================================================================
// SECTION C — Sales Efficiency (funnel + 4 rates + 6 efficiency cards)
// ============================================================================
function SectionC({ data, sqlFor }: { data: SectionCData; sqlFor: SqlForFn }) {
  const pros = data.prospects || 1; // avoid divide-by-zero in bar widths
  const stages: { label: string; value: number; color: string; bgColor: string; borderColor: string; tip: string; key: MetricKey }[] = [
    { label: "Prospects", value: data.prospects, color: "var(--blue)", bgColor: "rgba(59,130,246,.06)", borderColor: "rgba(59,130,246,.3)", tip: TIP.funnelProspects, key: "funnelProspects" },
    { label: "Prospects (SQ)", value: data.prospectsSq, color: "var(--blue)", bgColor: "rgba(59,130,246,.05)", borderColor: "rgba(59,130,246,.25)", tip: TIP.funnelProspectsSq, key: "funnelProspectsSq" },
    { label: "Shows", value: data.showsSq, color: "var(--green)", bgColor: "rgba(16,185,129,.06)", borderColor: "rgba(16,185,129,.3)", tip: TIP.funnelShows, key: "funnelShows" },
    { label: "Qualified Shows", value: data.showsCq, color: "var(--amber)", bgColor: "rgba(245,158,11,.06)", borderColor: "rgba(245,158,11,.3)", tip: TIP.funnelQualifiedShows, key: "funnelQualifiedShows" },
    { label: "Deals", value: data.deals, color: "var(--purple)", bgColor: "rgba(139,92,246,.07)", borderColor: "rgba(139,92,246,.3)", tip: TIP.funnelDeals, key: "funnelDeals" },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Section C · Sales Efficiency</div>
      <p className={styles.sectionIntro}>
        Funnel volume, conversion rates, and dollar-efficiency. Date basis: <code className={styles.code}>DATE(appointment_date_time)</code>.
      </p>

      <div className={styles.funnel}>
        {stages.map((s, i) => (
          <div key={s.label}>
            <div className={styles.fRow}>
              <div
                className={styles.fBar}
                style={{
                  background: s.bgColor,
                  borderColor: s.borderColor,
                  width: `${(s.value / pros) * 100}%`,
                }}
              >
                <span className={styles.fLabel} style={{ color: s.color, cursor: "help" }} data-tip={s.tip}>{s.label}</span>
                {(() => { const r = sqlFor(s.key); return r ? <SqlInfoButton resolved={r} /> : null; })()}
                <span className={styles.fVal} style={{ color: s.color }}>{fmtInt(s.value)}</span>
              </div>
            </div>
            {i === 0 ? (
              <div className={styles.fConn}>
                <span className={styles.fRate}>Pros (D'd) {fmtInt(data.prospectsDd)} · Setter DQ {fmtInt(data.setterDq)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.sh} style={{ marginTop: 8 }}>Funnel Rates</div>
      <div className={styles.kpiGridMini}>
        <MiniCard emoji="📈" label="Show Rate" value={fmtPct(data.showRate)} change="Shows / Pros (SQ)" tip={TIP.showRate} sqlInfo={sqlFor("showRate")} />
        <MiniCard emoji="🎯" label="Close Rate (Shows)" value={fmtPct(data.closeRateShows)} change="Deals / Shows" tip={TIP.closeRateShows} sqlInfo={sqlFor("closeRateShows")} />
        <MiniCard emoji="🎯" label="Close Rate (CQ)" value={fmtPct(data.closeRate)} change="Deals / Qualified Shows" tip={TIP.closeRateCq} sqlInfo={sqlFor("closeRateCq")} />
        <MiniCard emoji="🚫" label="Setter DQ Rate" value={fmtPct(data.setterDqRate)} change="Setter DQ / Pros (D'd)" tip={TIP.setterDqRate} sqlInfo={sqlFor("setterDqRate")} />
        <MiniCard emoji="🚫" label="Closer DQ Rate" value={fmtPct(data.closerDqRate)} change="Closer DQ / Shows" tip={TIP.closerDqRate} sqlInfo={sqlFor("closerDqRate")} />
      </div>

      <div className={styles.sh} style={{ marginTop: 8 }}>Prospect Efficiency (D'd → Downstream)</div>
      <div className={styles.kpiGridMini}>
        <MiniCard emoji="⚙" label="Prospect to Qualified Show Efficiency" value={fmtPct(data.ddToCq)} change="Shows (CQ) / Pros (D'd)" tip={TIP.ddToCq} sqlInfo={sqlFor("ddToCq")} />
        <MiniCard emoji="⚙" label="Prospect to Close Efficiency" value={fmtPct(data.ddToClose)} change="Deals / Pros (D'd)" tip={TIP.ddToClose} sqlInfo={sqlFor("ddToClose")} />
        <MiniCard emoji="💰" label="$ (CC) / Pros (D'd)" value={fmtUsd2(data.dollarsCcPerPdd)} change="Cash / Pros (D'd)" tip={TIP.dollarsCcPerPdd} sqlInfo={sqlFor("dollarsCcPerPdd")} />
        <MiniCard emoji="💰" label="$ (CC) / Shows (SQ)" value={fmtUsd2(data.dollarsCcPerShowsSq)} change="Cash / Shows (SQ)" tip={TIP.dollarsCcPerShowsSq} sqlInfo={sqlFor("dollarsCcPerShowsSq")} />
        <MiniCard emoji="📦" label="$ (TCV) / Pros (D'd)" value={fmtUsd2(data.dollarsTcvPerPdd)} change="TCV / Pros (D'd)" tip={TIP.dollarsTcvPerPdd} sqlInfo={sqlFor("dollarsTcvPerPdd")} />
        <MiniCard emoji="📦" label="$ (TCV) / Shows (SQ)" value={fmtUsd2(data.dollarsTcvPerShowsSq)} change="TCV / Shows (SQ)" tip={TIP.dollarsTcvPerShowsSq} sqlInfo={sqlFor("dollarsTcvPerShowsSq")} />
      </div>
    </section>
  );
}

// ============================================================================
// SECTION D — Per-Person KPIs (placeholder)
// ============================================================================
function SectionD() {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Section D · Per-Person KPIs</div>
      <div className={styles.placeholder}>
        <h4>Per-Person KPIs — Awaiting Marek's KPI Assignment List</h4>
        <p>
          Each team member's KEY KPI + current number will render here once Marek shares
          the per-person assignments.
        </p>
        <p style={{ marginTop: 8, fontStyle: "italic" }}>Owner: Marek</p>
      </div>
    </section>
  );
}

// ============================================================================
// Mini KPI card primitive
// ============================================================================
function MiniCard({
  emoji,
  label,
  value,
  change,
  tip,
  sqlInfo,
  trafficKey,
  rawValue,
}: {
  emoji: string;
  label: string;
  value: string;
  change: string;
  tip?: string;
  sqlInfo?: import("@/lib/dev-sql").ResolvedMetricSql | null;
  /** Threshold key to color the value (green/orange/red). */
  trafficKey?: ThresholdKey;
  /** Raw numeric value for the threshold check (the rendered `value` is pre-formatted). */
  rawValue?: number | null;
}) {
  const light = trafficKey ? getTrafficLight(rawValue, trafficKey) : "neutral";
  const color = trafficLightColor(light);
  return (
    <div className={styles.kpiMini}>
      <div className={styles.kpiMiniLbl}>
        <span>{emoji}</span>
        <span data-tip={tip} style={tip ? { cursor: "help" } : undefined}>{label}</span>
        {sqlInfo ? <SqlInfoButton resolved={sqlInfo} /> : null}
      </div>
      <div className={styles.kpiMiniVal} style={color ? { color } : undefined}>{value}</div>
      {change ? <div className={styles.kpiMiniCh}>{change}</div> : null}
    </div>
  );
}

function target(t: string): string {
  return `Target ${t}`;
}
