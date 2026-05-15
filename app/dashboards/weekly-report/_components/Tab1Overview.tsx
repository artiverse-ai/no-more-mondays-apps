import type { SectionAData, SectionBData, SectionCData } from "@/lib/weekly-report-bq-v2";
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
  sectionB: SectionBData;
  sectionC: SectionCData;
};

export function Tab1Overview({ weekLabel, sectionA, sectionB, sectionC }: Tab1OverviewProps) {
  return (
    <>
      <SectionA data={sectionA} weekLabel={weekLabel} />
      <SectionB data={sectionB} />
      <SectionC data={sectionC} />
      <SectionD />
    </>
  );
}

// ============================================================================
// SECTION A — Overall Company Performance (10 money cards + 4 cycle cards)
// ============================================================================
function SectionA({ data, weekLabel }: { data: SectionAData; weekLabel: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Section A · Overall Company Performance</div>
      <p className={styles.sectionIntro}>
        Company-wide money, deals, and cycle times. {weekLabel}.
      </p>
      <div className={styles.kpiGridMini}>
        <MiniCard emoji="💰" label="Cash Collected" value={fmtUsd(data.cashCollected)} change="Fanbasis + Whop" />
        <MiniCard emoji="💼" label="Revenue (TCV)" value={fmtUsd(data.revenueTcv)} change="Total Contract Value" />
        <MiniCard emoji="📈" label="ROAS (Cash)" value={fmtX(data.roasCash)} change={target("4×")} />
        <MiniCard emoji="📈" label="ROAS (TCV)" value={fmtX(data.roasTcv)} change="TCV / Ad Spend" />
        <MiniCard emoji="📣" label="Ad Spend (Blended)" value={fmtUsd(data.adSpendBlended)} change="All Meta campaigns" />
        <MiniCard emoji="🤝" label="Deals Closed" value={fmtInt(data.dealsClosed)} change="" />
        <MiniCard emoji="💵" label="AOV" value={fmtUsd(data.aov)} change="Fanbasis cash / deals" />
        <MiniCard emoji="📦" label="ACV" value={fmtUsd(data.acv)} change="TCV / deals" />
        <MiniCard emoji="💸" label="PIF Rate" value={fmtPct(data.pifRate)} change="Paid-In-Full deals" />
        <MiniCard emoji="📊" label="Cash Collection Rate" value={fmtPct(data.cashCollectionRate)} change="Cash / TCV" />
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
        />
        <MiniCard
          emoji="⏱"
          label="OCC Average"
          value={fmtDays(data.avgBookToCloseOcc)}
          change={`Book → Close on call`}
        />
        <MiniCard
          emoji="⏱"
          label="FUC Median"
          value={fmtDays(data.medianFirstCallToCloseFuc)}
          change={`n = ${data.nFuc} follow-up closes`}
        />
        <MiniCard
          emoji="⏱"
          label="FUC Average"
          value={fmtDays(data.avgFirstCallToCloseFuc)}
          change={`1st Call → Close`}
        />
      </div>
    </section>
  );
}

// ============================================================================
// SECTION B — Marketing Efficiency (5 cards)
// ============================================================================
function SectionB({ data }: { data: SectionBData }) {
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
        />
        <MiniCard
          emoji="📞"
          label="Cost / Booked Call"
          value={fmtUsd2(data.costPerBookedCall)}
          change="Ad Spend / Calls Booked"
        />
        <MiniCard
          emoji="💰"
          label="Cash / Booked Call (DPC)"
          value={fmtUsd2(data.cashPerBookedCall)}
          change="Sergio's KPI"
        />
        <MiniCard
          emoji="📊"
          label="Avg Webinar Show Rate"
          value={fmtPct(data.avgWebinarShowRate)}
          change={target("24%")}
        />
        <MiniCard
          emoji="📈"
          label="CPL Blended"
          value={fmtUsd2(data.cplBlended)}
          change={target("<$7")}
        />
      </div>
    </section>
  );
}

// ============================================================================
// SECTION C — Sales Efficiency (funnel + 4 rates + 6 efficiency cards)
// ============================================================================
function SectionC({ data }: { data: SectionCData }) {
  const pros = data.prospects || 1; // avoid divide-by-zero in bar widths
  const stages = [
    { label: "Prospects", value: data.prospects, color: "var(--blue)", bgColor: "rgba(59,130,246,.06)", borderColor: "rgba(59,130,246,.3)" },
    { label: "Prospects (SQ)", value: data.prospectsSq, color: "var(--blue)", bgColor: "rgba(59,130,246,.05)", borderColor: "rgba(59,130,246,.25)" },
    { label: "Shows", value: data.showsSq, color: "var(--green)", bgColor: "rgba(16,185,129,.06)", borderColor: "rgba(16,185,129,.3)" },
    { label: "Qualified Shows", value: data.showsCq, color: "var(--amber)", bgColor: "rgba(245,158,11,.06)", borderColor: "rgba(245,158,11,.3)" },
    { label: "Deals", value: data.deals, color: "var(--purple)", bgColor: "rgba(139,92,246,.07)", borderColor: "rgba(139,92,246,.3)" },
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
                <span className={styles.fLabel} style={{ color: s.color }}>{s.label}</span>
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
        <MiniCard emoji="📈" label="Show Rate" value={fmtPct(data.showRate)} change="Shows / Pros (SQ)" />
        <MiniCard emoji="🎯" label="Close Rate (Shows)" value={fmtPct(data.closeRateShows)} change="Deals / Shows" />
        <MiniCard emoji="🎯" label="Close Rate (CQ)" value={fmtPct(data.closeRate)} change="Deals / Qualified Shows" />
        <MiniCard emoji="🚫" label="Setter DQ Rate" value={fmtPct(data.setterDqRate)} change="Setter DQ / Pros (D'd)" />
        <MiniCard emoji="🚫" label="Closer DQ Rate" value={fmtPct(data.closerDqRate)} change="Closer DQ / Shows" />
      </div>

      <div className={styles.sh} style={{ marginTop: 8 }}>Prospect Efficiency (D'd → Downstream)</div>
      <div className={styles.kpiGridMini}>
        <MiniCard emoji="⚙" label="D'd → CQ" value={fmtPct(data.ddToCq)} change="Shows (CQ) / Pros (D'd)" />
        <MiniCard emoji="⚙" label="D'd → Close" value={fmtPct(data.ddToClose)} change="Deals / Pros (D'd)" />
        <MiniCard emoji="💰" label="$ (CC) / Pros (D'd)" value={fmtUsd2(data.dollarsCcPerPdd)} change="Cash / Pros (D'd)" />
        <MiniCard emoji="💰" label="$ (CC) / Shows (SQ)" value={fmtUsd2(data.dollarsCcPerShowsSq)} change="Cash / Shows (SQ)" />
        <MiniCard emoji="📦" label="$ (TCV) / Pros (D'd)" value={fmtUsd2(data.dollarsTcvPerPdd)} change="TCV / Pros (D'd)" />
        <MiniCard emoji="📦" label="$ (TCV) / Shows (SQ)" value={fmtUsd2(data.dollarsTcvPerShowsSq)} change="TCV / Shows (SQ)" />
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
function MiniCard({ emoji, label, value, change }: { emoji: string; label: string; value: string; change: string }) {
  return (
    <div className={styles.kpiMini}>
      <div className={styles.kpiMiniLbl}>
        <span>{emoji}</span>
        <span>{label}</span>
      </div>
      <div className={styles.kpiMiniVal}>{value}</div>
      {change ? <div className={styles.kpiMiniCh}>{change}</div> : null}
    </div>
  );
}

function target(t: string): string {
  return `Target ${t}`;
}
