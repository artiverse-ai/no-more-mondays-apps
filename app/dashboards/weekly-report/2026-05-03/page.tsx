import { getCurrentUser } from "@/lib/auth";
import {
  MARKETING_EDITOR,
  SALES_EDITOR,
  listSolutions,
} from "@/lib/weekly-report-solutions";
import {
  buildBookingMode,
  buildChannelMix,
  buildChannelMixTrend,
  buildCloserOverall,
  buildCloserOverallTotal,
  buildCloserPerWebinar,
  buildCloserWoW,
  buildFunnelConnectors,
  buildFunnelStages,
  buildKpiCards,
  buildReactivationFunnel,
  buildSetterPerformance,
  buildTopOfFunnelRows,
  buildWoWComparison,
  fetchWeeklyReport,
} from "@/lib/weekly-report-bq";
import { SolutionsTab } from "./SolutionsTab";
import { Tabs } from "./Tabs";
import { Tip, TooltipLayer } from "./Tooltip";
import styles from "./report.module.css";
import {
  INSIGHTS,
  MAIN_CAMPAIGN_CPL_TREND,
  MAY_10_CONTEXT,
  META_CAMPAIGNS,
  META_CAMPAIGN_TOTAL,
  REPORT_META,
} from "./data";

const REPORT_WEEK = "2026-05-03";

export const metadata = {
  title: "Weekly Report — May 3-9, 2026 · No More Mondays",
};

// Re-fetch on every request — BQ data moves as deals close. The render is
// cheap and our internal-tool traffic is tiny.
export const revalidate = 0;

const COLORS = {
  blue: "var(--blue)",
  green: "var(--green)",
  amber: "var(--amber)",
  purple: "var(--purple)",
} as const;

export default async function Page() {
  const me = await getCurrentUser();

  // All BQ fetches in parallel.
  const [reportData, mktInitial, salesInitial] = await Promise.all([
    fetchWeeklyReport(REPORT_WEEK),
    listSolutions(REPORT_WEEK, "marketing").catch(() => []),
    listSolutions(REPORT_WEEK, "sales").catch(() => []),
  ]);

  // Build the shapes the tab components consume.
  const topOfFunnel = buildTopOfFunnelRows(reportData.webinars);
  const channelMix = buildChannelMix(reportData.webinars[0]);
  const channelMixTrend = buildChannelMixTrend(reportData.webinars);
  const reactivation = buildReactivationFunnel(reportData.webinars);

  const funnelStages = buildFunnelStages(reportData.thisWeekFunnel);
  const funnelConnectors = buildFunnelConnectors(reportData.thisWeekFunnel);
  const kpiCards = buildKpiCards(reportData.thisWeekFunnel, reportData.priorWeekFunnel);
  const wowRows = buildWoWComparison(reportData.thisWeekFunnel, reportData.priorWeekFunnel);
  const closerOverall = buildCloserOverall(reportData.closerOverall);
  const closerOverallTotal = buildCloserOverallTotal(reportData.thisWeekFunnel);
  const closerWoW = buildCloserWoW(reportData.closerWoW);
  const perWebinarMostRecent = buildCloserPerWebinar(reportData.perWebinarMostRecent);
  const perWebinarSecond = buildCloserPerWebinar(reportData.perWebinarSecond);
  const bookingMode = buildBookingMode(reportData.bookingMode);
  const setterPerf = buildSetterPerformance(reportData.setterPerformance);

  const t1Data = {
    topOfFunnel,
    channelMix,
    channelMixTrend,
    reactivation,
    webinarDates: reportData.window.webinarDates,
  };
  const t2Data = {
    funnelStages,
    funnelConnectors,
    kpiCards,
    wowRows,
    closerOverall,
    closerOverallTotal,
    closerWoW,
    perWebinarMostRecent,
    perWebinarSecond,
    bookingMode,
    setterPerf,
    webinarDates: reportData.window.webinarDates,
  };

  return (
    <div className={styles.bg}>
      <TooltipLayer />
      <div className={styles.hdr}>
        <h1>NMM Weekly Report</h1>
        <span className={styles.sub}>
          {REPORT_META.weekLabel} &nbsp;·&nbsp; Latest Webinar: {REPORT_META.latestWebinar}
        </span>
        <span className={styles.badge}>{REPORT_META.badge}</span>
      </div>
      <Tabs
        tabs={[
          { id: "t1", label: "Latest Webinar" },
          { id: "t2", label: "Last Week's Sales" },
          { id: "t3", label: "Strategic Insights" },
          { id: "t4", label: "Marketing Solutions" },
          { id: "t5", label: "Sales Solutions" },
        ]}
        defaultActive="t1"
        panels={{
          t1: <Tab1 {...t1Data} />,
          t2: <Tab2 {...t2Data} />,
          t3: <Tab3 />,
          t4: (
            <SolutionsTab
              reportWeek={REPORT_WEEK}
              tab="marketing"
              editorEmail={MARKETING_EDITOR}
              initial={mktInitial}
              currentUserEmail={me?.email ?? ""}
              currentUserIsAdmin={Boolean(me?.isAdmin)}
            />
          ),
          t5: (
            <SolutionsTab
              reportWeek={REPORT_WEEK}
              tab="sales"
              editorEmail={SALES_EDITOR}
              initial={salesInitial}
              currentUserEmail={me?.email ?? ""}
              currentUserIsAdmin={Boolean(me?.isAdmin)}
            />
          ),
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  TAB 1 — Latest Webinar (BQ-fed numbers; static commentary)
// ════════════════════════════════════════════════════════════════════════

type Tab1Props = {
  topOfFunnel: ReturnType<typeof buildTopOfFunnelRows>;
  channelMix: ReturnType<typeof buildChannelMix>;
  channelMixTrend: ReturnType<typeof buildChannelMixTrend>;
  reactivation: ReturnType<typeof buildReactivationFunnel>;
  webinarDates: string[];
};

function Tab1({ topOfFunnel, channelMix, channelMixTrend, reactivation, webinarDates }: Tab1Props) {
  const headers = webinarDates.length >= 3
    ? webinarDates.slice(0, 3)
    : [...webinarDates, "—", "—", "—"].slice(0, 3);
  const totalReg = channelMix.reduce((s, c) => s + c.count, 0);

  return (
    <>
      {/* Context banner — narrative, stays static */}
      <div className={styles.ctxBanner}>
        <div className={styles.ctxTag}>⚙ {MAY_10_CONTEXT.tag}</div>
        <h3>{MAY_10_CONTEXT.title}</h3>
        <ul className={styles.ctxList}>
          {MAY_10_CONTEXT.bullets.map((b, i) => (
            <li key={i}>
              <strong>{b.lead}</strong> {b.body}
              {b.code ? <code className={styles.code}>{b.code}</code> : null}
              {b.strong ? <strong>{b.strong}</strong> : null}
              {b.bodyAfter ?? ""}
            </li>
          ))}
        </ul>
        <div className={styles.ctxNote}>{MAY_10_CONTEXT.note}</div>
      </div>

      {/* Top-of-Funnel comparison */}
      <section className={styles.section}>
        <div className={styles.sh}>Top-of-Funnel Comparison (live · BQ-fed)</div>
        <div className={styles.tw}>
          <table className={styles.ct}>
            <thead>
              <tr>
                <th>Metric</th>
                <th className={styles.lhh}>{headers[0]}</th>
                <th>{headers[1]}</th>
                <th>{headers[2]}</th>
              </tr>
            </thead>
            <tbody>
              {topOfFunnel.map((r, i) =>
                r.kind === "divider" ? (
                  <tr key={i} className={styles.divRow}>
                    <td colSpan={4}>{r.label}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{r.tip ? <Tip tip={r.tip}>{r.label}</Tip> : r.label}</td>
                    {r.values.map((v, j) => (
                      <td key={j} className={j === 0 ? styles.lh : ""}>{v}</td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          Live from <code className={styles.code}>mart_webinar_events</code>. Numbers will move as the day progresses — refresh to re-pull.
        </div>
      </section>

      {/* Channel mix */}
      <section className={styles.section}>
        <div className={styles.sh}>Channel Mix — Latest Webinar ({totalReg} Registrants)</div>
        <div className={styles.twoCol}>
          <div>
            {channelMix.map((c) => (
              <div className={styles.chRow} key={c.name}>
                <div className={styles.chName}>{c.name}</div>
                <div className={styles.chBg}>
                  <div className={styles.chFill} style={{ width: `${c.pct}%`, background: COLORS[c.color] }} />
                </div>
                <div className={styles.chN}>{c.count}</div>
                <div className={styles.chP}>{c.pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div>
            <div className={styles.sh} style={{ marginBottom: 12 }}>Channel Mix Trend</div>
            <div className={styles.tw}>
              <table className={styles.dt}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Channel</th>
                    <th className={styles.lhh}>{headers[0]}</th>
                    <th>{headers[1]}</th>
                    <th>{headers[2]}</th>
                  </tr>
                </thead>
                <tbody>
                  {channelMixTrend.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className={`${styles.lh} ${r.dn ? styles.dn : ""}`}>{r.may10}</td>
                      <td>{r.may6}</td>
                      <td>{r.may3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Campaigns — still static (different table grain, see backlog) */}
      <section className={styles.section}>
        <div className={styles.sh}>Meta Campaigns — Week of {headers[0]} Promo Window (static — backlog)</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Campaign</th>
                <th>Spend</th>
                <th>Impr.</th>
                <th>Clicks</th>
                <th>Conv.</th>
                <th>CPL</th>
              </tr>
            </thead>
            <tbody>
              {META_CAMPAIGNS.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className={c.amber ? styles.amb : ""}>{c.spend}</td>
                  <td>{c.impr}</td>
                  <td>{c.clicks}</td>
                  <td className={c.dn ? styles.dn : ""}>{c.conv}</td>
                  <td className={c.dn ? styles.dn : ""}>{c.cpl}</td>
                </tr>
              ))}
              <tr className={styles.divRow}>
                <td colSpan={6}>Lead-gen Total (excl. retargeting)</td>
              </tr>
              <tr>
                <td>{META_CAMPAIGN_TOTAL.label}</td>
                <td><strong>{META_CAMPAIGN_TOTAL.spend}</strong></td>
                <td>{META_CAMPAIGN_TOTAL.impr}</td>
                <td>{META_CAMPAIGN_TOTAL.clicks}</td>
                <td>{META_CAMPAIGN_TOTAL.conv}</td>
                <td>{META_CAMPAIGN_TOTAL.cpl}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <br />
        <div className={styles.sh} style={{ marginBottom: 12 }}>Main Campaign CPL Trend</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Campaign</th>
                <th className={styles.lhh}>May 10 wk</th>
                <th>May 3 wk</th>
                <th>Apr 26 wk</th>
              </tr>
            </thead>
            <tbody>
              {MAIN_CAMPAIGN_CPL_TREND.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={`${styles.lh} ${r.may10Class === "up" ? styles.up : r.may10Class === "dn" ? styles.dn : r.may10Class === "nt" ? styles.nt : ""}`}>{r.may10}</td>
                  <td>{r.may3}</td>
                  <td className={r.apr26Class === "dn" ? styles.dn : ""}>{r.apr26}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reactivation */}
      <section className={styles.section}>
        <div className={styles.sh}>Reactivation Funnel (live)</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Webinar</th>
                <th>Pool</th>
                <th>Attended</th>
                <th>Attend Rate</th>
                <th>Booked</th>
                <th>Book Rate</th>
              </tr>
            </thead>
            <tbody>
              {reactivation.map((r) => (
                <tr key={r.webinar}>
                  <td className={r.highlight ? styles.lh : ""}>{r.webinar}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.pool}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.attended}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.attendRate}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.booked}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.bookRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  TAB 2 — Last Week's Sales (BQ-fed)
// ════════════════════════════════════════════════════════════════════════

type Tab2Props = {
  funnelStages: ReturnType<typeof buildFunnelStages>;
  funnelConnectors: ReturnType<typeof buildFunnelConnectors>;
  kpiCards: ReturnType<typeof buildKpiCards>;
  wowRows: ReturnType<typeof buildWoWComparison>;
  closerOverall: ReturnType<typeof buildCloserOverall>;
  closerOverallTotal: ReturnType<typeof buildCloserOverallTotal>;
  closerWoW: ReturnType<typeof buildCloserWoW>;
  perWebinarMostRecent: ReturnType<typeof buildCloserPerWebinar>;
  perWebinarSecond: ReturnType<typeof buildCloserPerWebinar>;
  bookingMode: ReturnType<typeof buildBookingMode>;
  setterPerf: ReturnType<typeof buildSetterPerformance>;
  webinarDates: string[];
};

function Tab2(p: Tab2Props) {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sh}>Sales Funnel — Week May 3–9, 2026 (live)</div>
        <div className={styles.funnel}>
          {p.funnelStages.map((s, i) => {
            const conn = i < p.funnelConnectors.length ? p.funnelConnectors[i] : null;
            const color = COLORS[s.color as keyof typeof COLORS];
            const bgRgba = colorRgba(s.color, 0.09);
            const borderRgba = colorRgba(s.color, 0.22);
            return (
              <div key={s.label}>
                <div className={styles.fRow}>
                  <div
                    className={styles.fBar}
                    style={{ background: bgRgba, border: `1px solid ${borderRgba}`, width: `${s.width}%` }}
                  >
                    <span className={styles.fLabel} style={{ color }}>
                      <Tip tip={s.tip}>{s.label}</Tip>
                    </span>
                    <span className={styles.fVal} style={{ color }}>{s.value}</span>
                  </div>
                </div>
                {conn ? (
                  <div className={styles.fConn}>
                    <span
                      className={styles.fRate}
                      style={conn.rateColor === "green" ? { background: "rgba(74,222,128,.08)", color: "var(--green)" } : undefined}
                    >
                      {conn.rate}
                    </span>
                    <span className={styles.fDrop}>{conn.drop}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={styles.kpiGrid}>
          {p.kpiCards.map((k) => (
            <div className={styles.kpi} key={k.label}>
              <div className={styles.kpiLbl}><Tip tip={k.tip}>{k.label}</Tip></div>
              <div className={styles.kpiVal}>{k.value}</div>
              <div className={`${styles.kpiCh} ${k.changeClass === "up" ? styles.up : k.changeClass === "dn" ? styles.dn : ""}`}>{k.change}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Week-over-Week Comparison</div>
        <div className={styles.tw}>
          <table className={styles.ct}>
            <thead>
              <tr>
                <th>Metric</th>
                <th className={styles.lhh}>This Week</th>
                <th>Prior</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {p.wowRows.map((r, i) =>
                r.kind === "divider" ? (
                  <tr key={i} className={styles.divRow}><td colSpan={4}>{r.label}</td></tr>
                ) : (
                  <tr key={i}>
                    <td>{r.tip ? <Tip tip={r.tip}>{r.label}</Tip> : r.label}</td>
                    <td className={`${styles.lh} ${r.thisWeekClass ? styles[r.thisWeekClass as keyof typeof styles] : ""}`}>{r.thisWeek}</td>
                    <td>{r.prior}</td>
                    <td className={r.changeClass === "up" ? styles.up : r.changeClass === "dn" ? styles.dn : styles.nt}>{r.change}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Closer Performance — Per Webinar (booking_week_sun basis)</div>
        <div className={styles.twoCol}>
          <PerWebinarTable title={p.webinarDates[1] ?? "—"} rows={p.perWebinarMostRecent} />
          <PerWebinarTable title={p.webinarDates[2] ?? "—"} rows={p.perWebinarSecond} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Closer Performance — Overall (appointment_date_time, May 3–9)</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Closer</th>
                <th>Prospects</th>
                <th>Pros (D&apos;d)</th>
                <th>S.DQ</th>
                <th>C.DQ</th>
                <th>Pros (SQ)</th>
                <th>Shows (SQ)</th>
                <th>Shows (CQ)</th>
                <th>Deals</th>
                <th>Cash</th>
                <th>Show%</th>
                <th>Close%</th>
              </tr>
            </thead>
            <tbody>
              {p.closerOverall.map((r) => (
                <tr key={r.closer}>
                  <td>{r.closer}</td>
                  <td>{r.prospects}</td>
                  <td>{r.prosD}</td>
                  <td>{r.sDQ}</td>
                  <td>{r.cDQ}</td>
                  <td>{r.prosSQ}</td>
                  <td>{r.showsSQ}</td>
                  <td>{r.showsCQ}</td>
                  <td className={r.upDeals ? styles.up : r.dnDeals ? styles.dn : ""}>{r.deals}</td>
                  <td className={r.upCash ? styles.up : r.dnCash ? styles.dn : ""}>{r.cash}</td>
                  <td className={r.upShow ? styles.up : ""}>{r.show}</td>
                  <td className={r.upClose ? styles.up : r.dnClose ? styles.dn : ""}>{r.close}</td>
                </tr>
              ))}
              <tr className={styles.divRow}><td colSpan={12}>Week Total</td></tr>
              <tr>
                <td><strong>{p.closerOverallTotal.label}</strong></td>
                <td>{p.closerOverallTotal.prospects}</td>
                <td>{p.closerOverallTotal.prosD}</td>
                <td>{p.closerOverallTotal.sDQ}</td>
                <td>{p.closerOverallTotal.cDQ}</td>
                <td>{p.closerOverallTotal.prosSQ}</td>
                <td>{p.closerOverallTotal.showsSQ}</td>
                <td>{p.closerOverallTotal.showsCQ}</td>
                <td>{p.closerOverallTotal.deals}</td>
                <td>{p.closerOverallTotal.cash}</td>
                <td>{p.closerOverallTotal.show}</td>
                <td>{p.closerOverallTotal.close}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <br />
        <div className={styles.sh} style={{ marginBottom: 12 }}>WoW Closer Comparison</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Closer</th>
                <th className={styles.lhh}>This wk Deals</th>
                <th className={styles.lhh}>This wk Cash</th>
                <th>Prior Deals</th>
                <th>Prior Cash</th>
              </tr>
            </thead>
            <tbody>
              {p.closerWoW.map((r) => (
                <tr key={r.closer}>
                  <td>{r.closer}</td>
                  <td className={`${styles.lh} ${r.upDeals ? styles.up : r.dnDeals ? styles.dn : ""}`}>{r.deals}</td>
                  <td className={`${styles.lh} ${r.upCash ? styles.up : r.dnCash ? styles.dn : ""}`}>{r.cash}</td>
                  <td>{r.priorDeals}</td>
                  <td>{r.priorCash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Booking Mode &amp; Setter Performance — Week May 3–9</div>
        <div className={styles.twoCol}>
          <div>
            <div className={styles.sh} style={{ marginBottom: 12 }}>Booking Mode Split</div>
            <div className={styles.tw}>
              <table className={styles.dt}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Source</th>
                    <th>Prospects</th>
                    <th>Pros (SQ)</th>
                    <th>Shows (SQ)</th>
                    <th>Show%</th>
                    <th>Shows (CQ)</th>
                    <th>Deals</th>
                    <th>Cash</th>
                    <th>Close%</th>
                  </tr>
                </thead>
                <tbody>
                  {p.bookingMode.map((r) => (
                    <tr key={r.source}>
                      <td>{r.source}</td>
                      <td>{r.prospects}</td>
                      <td>{r.prosSQ}</td>
                      <td>{r.showsSQ}</td>
                      <td className={r.upShow ? styles.up : ""}>{r.showRate}</td>
                      <td>{r.showsCQ}</td>
                      <td>{r.deals}</td>
                      <td>{r.cash}</td>
                      <td>{r.close}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className={styles.sh} style={{ marginBottom: 12 }}>Setter Performance — by Booking Mode</div>
            <div className={styles.tw}>
              <table className={styles.dt} style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Setter</th>
                    <th>Mode</th>
                    <th>Pros (SQ)</th>
                    <th>Shows (SQ)</th>
                    <th>Show%</th>
                    <th>Deals</th>
                    <th>Cash</th>
                    <th><Tip tip="$300/week bonus: 80%+ overall show rate AND 20+ Prospects (SQ)">Bonus</Tip></th>
                  </tr>
                </thead>
                <tbody>
                  {p.setterPerf.map((s) => (
                    <SetterBlock key={s.name} setter={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function PerWebinarTable({ title, rows }: { title: string; rows: ReturnType<typeof buildCloserPerWebinar> }) {
  return (
    <div>
      <div className={styles.sh} style={{ marginBottom: 12 }}>{title}</div>
      <div className={styles.tw}>
        <table className={styles.dt}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Closer</th>
              <th>Prospects</th>
              <th>Pros (SQ)</th>
              <th>Shows (SQ)</th>
              <th>Shows (CQ)</th>
              <th>Deals</th>
              <th>Close%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>No data</td></tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.closer}>
                <td>{r.closer}</td>
                <td>{r.prospects}</td>
                <td>{r.prosSQ}</td>
                <td>{r.showsSQ}</td>
                <td>{r.showsCQ}</td>
                <td className={r.upDeals ? styles.up : ""}>{r.deals}</td>
                <td className={r.upClose ? styles.up : r.dnClose ? styles.dn : r.ntClose ? styles.nt : ""}>{r.close}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetterBlock({ setter }: { setter: ReturnType<typeof buildSetterPerformance>[number] }) {
  const toneClass = setter.bonus.tone === "dn" ? styles.dn : setter.bonus.tone === "amb" ? styles.amb : styles.up;
  return (
    <>
      {setter.rows.map((row, idx) => (
        <tr key={row.mode}>
          {idx === 0 ? <td rowSpan={2} style={{ fontWeight: 600 }}>{setter.name}</td> : null}
          <td>{row.mode}</td>
          <td>{row.prosSQ}</td>
          <td>{row.showsSQ}</td>
          <td className={row.upShow ? styles.up : row.dnShow ? styles.dn : ""}>{row.show}</td>
          <td>{row.deals}</td>
          <td>{row.cash}</td>
          {idx === 0 ? <td rowSpan={2} className={toneClass}><Tip tip={setter.bonus.tip}>{setter.bonus.label}</Tip></td> : null}
        </tr>
      ))}
      <tr className={styles.divRow}><td colSpan={7}>{setter.combined}</td></tr>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  TAB 3 — Strategic Insights (static commentary)
// ════════════════════════════════════════════════════════════════════════

function Tab3() {
  return (
    <>
      <div className={styles.sh} style={{ marginBottom: 20 }}>
        Strategic Insights — Week May 3–9 / Latest Webinar May 10
      </div>
      <div className={styles.insGrid}>
        {INSIGHTS.map((ins, i) => {
          const cls =
            ins.tone === "win" ? styles.insWin :
            ins.tone === "watch" ? styles.insWatch :
            ins.tone === "flag" ? styles.insFlag :
            ins.tone === "fix" ? styles.insFix :
            ins.tone === "fwd" ? styles.insFwd :
            styles.insCtx;
          const tagCls =
            ins.tone === "win" ? styles.insWinTag :
            ins.tone === "watch" ? styles.insWatchTag :
            ins.tone === "flag" ? styles.insFlagTag :
            ins.tone === "fix" ? styles.insFixTag :
            ins.tone === "fwd" ? styles.insFwdTag :
            styles.insCtxTag;
          return (
            <div key={i} className={`${styles.ins} ${cls}`}>
              <div className={`${styles.insTag} ${tagCls}`}>{ins.tag}</div>
              <h4>{ins.title}</h4>
              <p>{ins.body}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function colorRgba(name: string, alpha: number): string {
  const map: Record<string, [number, number, number]> = {
    blue: [96, 165, 250],
    green: [74, 222, 128],
    amber: [251, 191, 36],
    purple: [167, 139, 250],
  };
  const c = map[name] ?? map.blue;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}
