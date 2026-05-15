import type {
  SectionAData,
  SectionCData,
  CloserOverallExtended,
  SetterOverallRow,
  SetterByModeRow,
  BookingModeExtended,
} from "@/lib/weekly-report-bq-v2";
import { TIP } from "@/lib/metric-tips";
import styles from "./report.module.css";

const fmtInt = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtUsd = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtUsd2 = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const fmtPct = (frac: number | null, digits = 1) =>
  frac == null ? "—" : `${(frac * 100).toFixed(digits)}%`;
const fmtDays = (n: number | null, digits = 1) => (n == null ? "—" : `${n.toFixed(digits)}d`);

export type Tab3LastWeekSalesProps = {
  weekLabel: string;
  funnelData: SectionCData;            // §9.1 funnel + dollar yield
  thisWeek: SectionCData;              // §9.4 WoW — this week
  priorWeek: SectionCData;             // §9.4 WoW — prior week
  sectionA: SectionAData;              // §9.1 money cards (Cash, TCV, AOV, ACV, PIF rate, Cash Collection Rate)
  closerOverall: CloserOverallExtended[];  // §9.5
  setterOverall: SetterOverallRow[];   // §9.6 NEW
  setterByMode: SetterByModeRow[];     // §9.7
  bookingMode: BookingModeExtended[];  // §9.8
};

export function Tab3LastWeekSales(p: Tab3LastWeekSalesProps) {
  return (
    <>
      <FunnelPlusKpis weekLabel={p.weekLabel} funnel={p.funnelData} money={p.sectionA} />
      <WeekOverWeek thisWeek={p.thisWeek} priorWeek={p.priorWeek} />
      <CloserOverallTable rows={p.closerOverall} />
      <SetterOverallTable rows={p.setterOverall} />
      <SetterByModeTable rows={p.setterByMode} />
      <BookingModeTable rows={p.bookingMode} />
    </>
  );
}

// ----------------------------------------------------------------------------
// §9.1 — Funnel + Money + Funnel Rates + Dollar Yield
// ----------------------------------------------------------------------------
function FunnelPlusKpis({ weekLabel, funnel, money }: { weekLabel: string; funnel: SectionCData; money: SectionAData }) {
  const pros = funnel.prospects || 1;
  const stages = [
    { label: "Prospects", value: funnel.prospects, color: "var(--blue)", bg: "rgba(59,130,246,.06)", border: "rgba(59,130,246,.3)", tip: TIP.funnelProspects },
    { label: "Prospects (SQ)", value: funnel.prospectsSq, color: "var(--blue)", bg: "rgba(59,130,246,.05)", border: "rgba(59,130,246,.25)", tip: TIP.funnelProspectsSq },
    { label: "Shows", value: funnel.showsSq, color: "var(--green)", bg: "rgba(16,185,129,.06)", border: "rgba(16,185,129,.3)", tip: TIP.funnelShows },
    { label: "Qualified Shows", value: funnel.showsCq, color: "var(--amber)", bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.3)", tip: TIP.funnelQualifiedShows },
    { label: "Deals", value: funnel.deals, color: "var(--purple)", bg: "rgba(139,92,246,.07)", border: "rgba(139,92,246,.3)", tip: TIP.funnelDeals },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Sales Funnel — {weekLabel}</div>
      <div className={styles.funnel}>
        {stages.map((s) => (
          <div key={s.label}>
            <div className={styles.fRow}>
              <div className={styles.fBar} style={{ background: s.bg, borderColor: s.border, width: `${(s.value / pros) * 100}%` }}>
                <span className={styles.fLabel} style={{ color: s.color, cursor: "help" }} data-tip={s.tip}>{s.label}</span>
                <span className={styles.fVal} style={{ color: s.color }}>{fmtInt(s.value)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.sh} style={{ marginTop: 24 }}>Money</div>
      <div className={styles.kpiGridMini}>
        <Mini emoji="💰" label="Cash" value={fmtUsd(money.cashCollected)} change="Fanbasis (deal-week)" tip={TIP.cashCollected} />
        <Mini emoji="💼" label="Revenue (TCV)" value={fmtUsd(money.revenueTcv)} change="" tip={TIP.revenueTcv} />
        <Mini emoji="💵" label="AOV" value={fmtUsd(money.aov)} change="Cash / Deals" tip={TIP.aov} />
        <Mini emoji="📦" label="ACV" value={fmtUsd(money.acv)} change="TCV / Deals" tip={TIP.acv} />
        <Mini emoji="💸" label="PIF Rate" value={fmtPct(money.pifRate)} change="Paid-In-Full deals" tip={TIP.pifRate} />
        <Mini emoji="📊" label="Cash Collection Rate" value={fmtPct(money.cashCollectionRate)} change="Cash / TCV" tip={TIP.cashCollectionRate} />
      </div>

      <div className={styles.sh} style={{ marginTop: 24 }}>Funnel Rates</div>
      <div className={styles.kpiGridMini}>
        <Mini emoji="📈" label="Show Rate" value={fmtPct(funnel.showRate)} change="Shows / Pros (SQ)" tip={TIP.showRate} />
        <Mini emoji="🎯" label="Close Rate (Shows)" value={fmtPct(funnel.closeRateShows)} change="Deals / Shows" tip={TIP.closeRateShows} />
        <Mini emoji="🎯" label="Close Rate (CQ)" value={fmtPct(funnel.closeRate)} change="Deals / Qualified Shows" tip={TIP.closeRateCq} />
        <Mini emoji="🚫" label="Setter DQ Rate" value={fmtPct(funnel.setterDqRate)} change="Setter DQ / Pros (D'd)" tip={TIP.setterDqRate} />
        <Mini emoji="🚫" label="Closer DQ Rate" value={fmtPct(funnel.closerDqRate)} change="Closer DQ / Shows" tip={TIP.closerDqRate} />
      </div>

      <div className={styles.sh} style={{ marginTop: 24 }}>Dollar Yield Per Prospect</div>
      <div className={styles.kpiGridMini}>
        <Mini emoji="📈" label="CC / Pros (D'd)" value={fmtUsd2(funnel.dollarsCcPerPdd)} change="" tip={TIP.dollarsCcPerPdd} />
        <Mini emoji="📈" label="CV (TCV) / Pros (D'd)" value={fmtUsd2(funnel.dollarsTcvPerPdd)} change="" tip={TIP.dollarsTcvPerPdd} />
        <Mini emoji="📈" label="CC / Show" value={fmtUsd2(funnel.dollarsCcPerShowsSq)} change="" tip={TIP.dollarsCcPerShowsSq} />
        <Mini emoji="📈" label="CV (TCV) / Show" value={fmtUsd2(funnel.dollarsTcvPerShowsSq)} change="" tip={TIP.dollarsTcvPerShowsSq} />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// §9.4 — Week-over-Week comparison table
// ----------------------------------------------------------------------------
function WeekOverWeek({ thisWeek, priorWeek }: { thisWeek: SectionCData; priorWeek: SectionCData }) {
  const dlt = (a: number | null, b: number | null): { abs: number | null; pct: number | null } => {
    if (a == null || b == null) return { abs: null, pct: null };
    const abs = a - b;
    const pct = b !== 0 ? abs / b : null;
    return { abs, pct };
  };
  const row = (label: string, t: number | null, p: number | null, fmt: (n: number | null) => string) => {
    const d = dlt(t, p);
    return (
      <tr key={label}>
        <td>{label}</td>
        <td className={styles.lh}>{fmt(t)}</td>
        <td>{fmt(p)}</td>
        <td className={d.pct != null ? (d.pct > 0 ? styles.up : d.pct < 0 ? styles.dn : styles.nt) : styles.nt}>
          {d.abs == null ? "—" : `${d.abs > 0 ? "+" : ""}${fmt(d.abs).replace(/[—]/g, "")}`}
        </td>
        <td className={d.pct != null ? (d.pct > 0 ? styles.up : d.pct < 0 ? styles.dn : styles.nt) : styles.nt}>
          {d.pct == null ? "—" : `${d.pct > 0 ? "+" : ""}${(d.pct * 100).toFixed(1)}%`}
        </td>
      </tr>
    );
  };
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Week-over-Week Comparison</div>
      <div className={styles.tw}>
        <table className={styles.ct}>
          <thead>
            <tr>
              <th>Metric</th>
              <th className={styles.lhh}>This Week</th>
              <th>Prior Week</th>
              <th>Δ Abs</th>
              <th>Δ %</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.divRow}><td colSpan={5}>Funnel Volume</td></tr>
            {row("Prospects", thisWeek.prospects, priorWeek.prospects, fmtInt)}
            {row("Pros (D'd)", thisWeek.prospectsDd, priorWeek.prospectsDd, fmtInt)}
            {row("Setter DQ", thisWeek.setterDq, priorWeek.setterDq, fmtInt)}
            {row("Closer DQ", thisWeek.closerDq, priorWeek.closerDq, fmtInt)}
            {row("Pros (SQ)", thisWeek.prospectsSq, priorWeek.prospectsSq, fmtInt)}
            {row("Shows", thisWeek.showsSq, priorWeek.showsSq, fmtInt)}
            {row("Qualified Shows", thisWeek.showsCq, priorWeek.showsCq, fmtInt)}
            {row("Deals", thisWeek.deals, priorWeek.deals, fmtInt)}

            <tr className={styles.divRow}><td colSpan={5}>Rates</td></tr>
            {row("Show Rate", thisWeek.showRate, priorWeek.showRate, (v) => fmtPct(v))}
            {row("Close Rate (Shows)", thisWeek.closeRateShows, priorWeek.closeRateShows, (v) => fmtPct(v))}
            {row("Close Rate (CQ)", thisWeek.closeRate, priorWeek.closeRate, (v) => fmtPct(v))}
            {row("Setter DQ Rate", thisWeek.setterDqRate, priorWeek.setterDqRate, (v) => fmtPct(v))}
            {row("Closer DQ Rate", thisWeek.closerDqRate, priorWeek.closerDqRate, (v) => fmtPct(v))}

            <tr className={styles.divRow}><td colSpan={5}>Money</td></tr>
            {row("Cash (int_calls)", thisWeek.cashIntCalls, priorWeek.cashIntCalls, fmtUsd)}
            {row("Revenue (TCV)", thisWeek.revenue, priorWeek.revenue, fmtUsd)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// §9.5 — Closer Performance Overall (15 cols)
// ----------------------------------------------------------------------------
function CloserOverallTable({ rows }: { rows: CloserOverallExtended[] }) {
  const totals = rows.reduce(
    (acc, r) => ({
      prospects: acc.prospects + r.prospects,
      prospectsDd: acc.prospectsDd + r.prospectsDd,
      setterDq: acc.setterDq + r.setterDq,
      closerDq: acc.closerDq + r.closerDq,
      prospectsSq: acc.prospectsSq + r.prospectsSq,
      shows: acc.shows + r.shows,
      qualifiedShows: acc.qualifiedShows + r.qualifiedShows,
      deals: acc.deals + r.deals,
      cash: acc.cash + r.cash,
    }),
    { prospects: 0, prospectsDd: 0, setterDq: 0, closerDq: 0, prospectsSq: 0, shows: 0, qualifiedShows: 0, deals: 0, cash: 0 },
  );
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Closer Performance — Overall</div>
      <div className={styles.tw}>
        <table className={styles.dt} style={{ fontSize: 11.5 }}>
          <thead>
            <tr>
              <th>Closer</th>
              <th data-tip={TIP.tbl_prospects}>Prospects</th>
              <th data-tip={TIP.tbl_dd}>D'd</th>
              <th data-tip={TIP.tbl_sDq}>S.DQ</th>
              <th data-tip={TIP.tbl_sDqPct}>S.DQ%</th>
              <th data-tip={TIP.tbl_cDq}>C.DQ</th>
              <th data-tip={TIP.tbl_cDqPct}>C.DQ%</th>
              <th data-tip={TIP.tbl_sq}>SQ</th>
              <th data-tip={TIP.tbl_shows}>Shows</th>
              <th data-tip={TIP.tbl_showPct}>Show%</th>
              <th data-tip={TIP.tbl_qShows}>Q.Shows</th>
              <th data-tip={TIP.tbl_closeShowsPct}>Close% Shows</th>
              <th data-tip={TIP.tbl_closeCqPct}>Close% CQ</th>
              <th data-tip={TIP.tbl_deals}>Deals</th>
              <th data-tip={TIP.tbl_cash}>Cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.closerOwner}>
                <td>{r.closerOwner}</td>
                <td>{fmtInt(r.prospects)}</td>
                <td>{fmtInt(r.prospectsDd)}</td>
                <td>{fmtInt(r.setterDq)}</td>
                <td>{fmtPct(r.setterDqRate)}</td>
                <td>{fmtInt(r.closerDq)}</td>
                <td>{fmtPct(r.closerDqRate)}</td>
                <td>{fmtInt(r.prospectsSq)}</td>
                <td>{fmtInt(r.shows)}</td>
                <td>{fmtPct(r.showRate)}</td>
                <td>{fmtInt(r.qualifiedShows)}</td>
                <td>{fmtPct(r.closeRateShows)}</td>
                <td>{fmtPct(r.closeRateCq)}</td>
                <td>{fmtInt(r.deals)}</td>
                <td>{fmtUsd(r.cash)}</td>
              </tr>
            ))}
            <tr className={styles.divRow}><td colSpan={15}>Week Total</td></tr>
            <tr>
              <td><strong>All Closers</strong></td>
              <td>{fmtInt(totals.prospects)}</td>
              <td>{fmtInt(totals.prospectsDd)}</td>
              <td>{fmtInt(totals.setterDq)}</td>
              <td>{fmtPct(totals.prospectsDd > 0 ? totals.setterDq / totals.prospectsDd : null)}</td>
              <td>{fmtInt(totals.closerDq)}</td>
              <td>{fmtPct(totals.shows > 0 ? totals.closerDq / totals.shows : null)}</td>
              <td>{fmtInt(totals.prospectsSq)}</td>
              <td>{fmtInt(totals.shows)}</td>
              <td>{fmtPct(totals.prospectsSq > 0 ? totals.shows / totals.prospectsSq : null)}</td>
              <td>{fmtInt(totals.qualifiedShows)}</td>
              <td>{fmtPct(totals.shows > 0 ? totals.deals / totals.shows : null)}</td>
              <td>{fmtPct(totals.qualifiedShows > 0 ? totals.deals / totals.qualifiedShows : null)}</td>
              <td>{fmtInt(totals.deals)}</td>
              <td>{fmtUsd(totals.cash)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// §9.6 — Setter Performance Overall (15 cols, NEW)
// ----------------------------------------------------------------------------
function SetterOverallTable({ rows }: { rows: SetterOverallRow[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Setter Performance — Overall</div>
      <div className={styles.tw}>
        <table className={styles.dt} style={{ fontSize: 11.5 }}>
          <thead>
            <tr>
              <th>Setter</th>
              <th data-tip={TIP.tbl_prospects}>Prospects</th>
              <th data-tip={TIP.tbl_dd}>D'd</th>
              <th data-tip={TIP.tbl_sDq}>S.DQ</th>
              <th data-tip={TIP.tbl_sDqPct}>S.DQ%</th>
              <th data-tip={TIP.tbl_cDq}>C.DQ</th>
              <th data-tip={TIP.tbl_cDqPct}>C.DQ%</th>
              <th data-tip={TIP.tbl_sq}>SQ</th>
              <th data-tip={TIP.tbl_shows}>Shows</th>
              <th data-tip={TIP.tbl_showPct}>Show%</th>
              <th data-tip={TIP.tbl_qShows}>Q.Shows</th>
              <th data-tip={TIP.tbl_closeShowsPct}>Close% Shows</th>
              <th data-tip={TIP.tbl_closeCqPct}>Close% CQ</th>
              <th data-tip={TIP.tbl_deals}>Deals</th>
              <th data-tip={TIP.tbl_cash}>Cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.setterOwner}>
                <td>{r.setterOwner}</td>
                <td>{fmtInt(r.prospects)}</td>
                <td>{fmtInt(r.prospectsDd)}</td>
                <td>{fmtInt(r.setterDq)}</td>
                <td>{fmtPct(r.setterDqRate)}</td>
                <td>{fmtInt(r.closerDq)}</td>
                <td>{fmtPct(r.closerDqRate)}</td>
                <td>{fmtInt(r.prospectsSq)}</td>
                <td>{fmtInt(r.shows)}</td>
                <td>{fmtPct(r.showRate)}</td>
                <td>{fmtInt(r.qualifiedShows)}</td>
                <td>{fmtPct(r.closeRateShows)}</td>
                <td>{fmtPct(r.closeRateCq)}</td>
                <td>{fmtInt(r.deals)}</td>
                <td>{fmtUsd(r.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// §9.7 — Setter Performance by Booking Mode (page-width)
// ----------------------------------------------------------------------------
function SetterByModeTable({ rows }: { rows: SetterByModeRow[] }) {
  // Group rows by setter for row-spanned rendering
  const bySetter = new Map<string, SetterByModeRow[]>();
  for (const r of rows) {
    const arr = bySetter.get(r.setterOwner) ?? [];
    arr.push(r);
    bySetter.set(r.setterOwner, arr);
  }
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Setter Performance — by Booking Mode</div>
      <div className={styles.tw}>
        <table className={styles.dt} style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Setter</th>
              <th>Mode</th>
              <th data-tip={TIP.tbl_dd}>D'd</th>
              <th data-tip={TIP.tbl_sDq}>S.DQ</th>
              <th data-tip={TIP.tbl_sDqPct}>S.DQ%</th>
              <th data-tip={TIP.tbl_sq}>SQ</th>
              <th data-tip={TIP.tbl_shows}>Shows</th>
              <th data-tip={TIP.tbl_showPct}>Show%</th>
              <th data-tip={TIP.tbl_qShows}>Q.Shows</th>
              <th data-tip={TIP.tbl_closeShowsPct}>Close% Shows</th>
              <th data-tip={TIP.tbl_closeCqPct}>Close% CQ</th>
              <th data-tip={TIP.tbl_ttb}>TTB (d)</th>
              <th data-tip={TIP.tbl_deals}>Deals</th>
              <th data-tip={TIP.tbl_cash}>Cash</th>
              <th data-tip={TIP.tbl_bonus}>Bonus</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(bySetter.entries()).map(([setter, setterRows]) => {
              const combinedSq = setterRows.reduce((s, r) => s + r.prospectsSq, 0);
              const combinedShows = setterRows.reduce((s, r) => s + r.shows, 0);
              const combinedSr = combinedSq > 0 ? combinedShows / combinedSq : 0;
              const passVol = combinedSq >= 20;
              const passSr = combinedSr >= 0.8;
              const bonus = passVol && passSr
                ? { label: "✓ Bonus", tone: "up" as const }
                : !passSr && !passVol
                  ? { label: "✗ SR+Vol", tone: "dn" as const }
                  : !passSr
                    ? { label: "✗ SR", tone: "dn" as const }
                    : { label: "✗ Vol", tone: "amb" as const };
              return setterRows.map((r, idx) => (
                <tr key={`${setter}-${r.mode}`}>
                  {idx === 0 ? (
                    <td rowSpan={setterRows.length} style={{ fontWeight: 600 }}>{setter}</td>
                  ) : null}
                  <td>{r.mode}</td>
                  <td>{fmtInt(r.prospectsDd)}</td>
                  <td>{fmtInt(r.setterDq)}</td>
                  <td>{fmtPct(r.setterDqRate)}</td>
                  <td>{fmtInt(r.prospectsSq)}</td>
                  <td>{fmtInt(r.shows)}</td>
                  <td>{fmtPct(r.showRate)}</td>
                  <td>{fmtInt(r.qualifiedShows)}</td>
                  <td>{fmtPct(r.closeRateShows)}</td>
                  <td>{fmtPct(r.closeRateCq)}</td>
                  <td>{fmtDays(r.medianTimeToBookDays, 1)}</td>
                  <td>{fmtInt(r.deals)}</td>
                  <td>{fmtUsd(r.cash)}</td>
                  {idx === 0 ? (
                    <td rowSpan={setterRows.length} className={bonus.tone === "up" ? styles.up : bonus.tone === "dn" ? styles.dn : styles.amb}>
                      {bonus.label}
                    </td>
                  ) : null}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.fn}>
        <span className={styles.hi}>*</span> Bonus thresholds: combined SR ≥ 80% AND combined Pros (SQ) ≥ 20.
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// §9.8 — Booking Mode Split (page-width, bottom)
// ----------------------------------------------------------------------------
function BookingModeTable({ rows }: { rows: BookingModeExtended[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Booking Mode Split</div>
      <div className={styles.tw}>
        <table className={styles.dt} style={{ fontSize: 11.5 }}>
          <thead>
            <tr>
              <th>Mode</th>
              <th data-tip={TIP.tbl_prospects}>Prospects</th>
              <th data-tip={TIP.tbl_dd}>D'd</th>
              <th data-tip={TIP.tbl_sDq}>S.DQ</th>
              <th data-tip={TIP.tbl_sDqPct}>S.DQ%</th>
              <th data-tip={TIP.tbl_cDq}>C.DQ</th>
              <th data-tip={TIP.tbl_cDqPct}>C.DQ%</th>
              <th data-tip={TIP.tbl_sq}>SQ</th>
              <th data-tip={TIP.tbl_shows}>Shows</th>
              <th data-tip={TIP.tbl_showPct}>Show%</th>
              <th data-tip={TIP.tbl_qShows}>Q.Shows</th>
              <th data-tip={TIP.tbl_closeShowsPct}>Close% Shows</th>
              <th data-tip={TIP.tbl_closeCqPct}>Close% CQ</th>
              <th data-tip={TIP.tbl_deals}>Deals</th>
              <th data-tip={TIP.tbl_cash}>Cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bookingMode}>
                <td>{r.bookingMode}</td>
                <td>{fmtInt(r.prospects)}</td>
                <td>{fmtInt(r.prospectsDd)}</td>
                <td>{fmtInt(r.setterDq)}</td>
                <td>{fmtPct(r.setterDqRate)}</td>
                <td>{fmtInt(r.closerDq)}</td>
                <td>{fmtPct(r.closerDqRate)}</td>
                <td>{fmtInt(r.prospectsSq)}</td>
                <td>{fmtInt(r.shows)}</td>
                <td>{fmtPct(r.showRate)}</td>
                <td>{fmtInt(r.qualifiedShows)}</td>
                <td>{fmtPct(r.closeRateShows)}</td>
                <td>{fmtPct(r.closeRateCq)}</td>
                <td>{fmtInt(r.deals)}</td>
                <td>{fmtUsd(r.cash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Shared Mini KPI card
// ----------------------------------------------------------------------------
function Mini({ emoji, label, value, change, tip }: { emoji: string; label: string; value: string; change: string; tip?: string }) {
  return (
    <div className={styles.kpiMini}>
      <div className={styles.kpiMiniLbl}>
        <span>{emoji}</span>
        <span data-tip={tip} style={tip ? { cursor: "help" } : undefined}>{label}</span>
      </div>
      <div className={styles.kpiMiniVal}>{value}</div>
      {change ? <div className={styles.kpiMiniCh}>{change}</div> : null}
    </div>
  );
}
