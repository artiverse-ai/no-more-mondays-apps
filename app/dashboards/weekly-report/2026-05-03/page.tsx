import { getCurrentUser } from "@/lib/auth";
import {
  MARKETING_EDITOR,
  SALES_EDITOR,
  listSolutions,
} from "@/lib/weekly-report-solutions";
import { SolutionsTab } from "./SolutionsTab";
import { Tabs } from "./Tabs";
import { Tip, TooltipLayer } from "./Tooltip";
import styles from "./report.module.css";

const REPORT_WEEK = "2026-05-03";
import {
  BOOKING_MODE,
  CHANNEL_MIX_MAY10,
  CHANNEL_MIX_TREND,
  CLOSER_OVERALL,
  CLOSER_OVERALL_TOTAL,
  CLOSER_WOW,
  FUNNEL_CONNECTORS,
  FUNNEL_STAGES,
  INSIGHTS,
  KPI_CARDS,
  MAIN_CAMPAIGN_CPL_TREND,
  MAY_10_CONTEXT,
  META_CAMPAIGNS,
  META_CAMPAIGN_TOTAL,
  PER_WEBINAR_MAY3,
  PER_WEBINAR_MAY6,
  REACTIVATION_FUNNEL,
  REPORT_META,
  SETTER_PERF,
  TOP_OF_FUNNEL,
  WOW_COMPARISON,
} from "./data";

export const metadata = {
  title: "Weekly Report — May 3-9, 2026 · No More Mondays",
};

const COLORS = {
  blue: "var(--blue)",
  green: "var(--green)",
  amber: "var(--amber)",
  purple: "var(--purple)",
} as const;

export default async function Page() {
  const me = await getCurrentUser();
  // Pre-fetch the solutions server-side so the tabs render populated.
  // Swallow failures (BQ unreachable, etc.) — the tab will just start empty
  // and the user can post once the connection recovers.
  let mktInitial: Awaited<ReturnType<typeof listSolutions>> = [];
  let salesInitial: typeof mktInitial = [];
  try {
    [mktInitial, salesInitial] = await Promise.all([
      listSolutions(REPORT_WEEK, "marketing"),
      listSolutions(REPORT_WEEK, "sales"),
    ]);
  } catch {
    // ignore
  }

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
          t1: <Tab1 />,
          t2: <Tab2 />,
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
//  TAB 1 — Latest Webinar
// ════════════════════════════════════════════════════════════════════════

function Tab1() {
  return (
    <>
      {/* Context banner */}
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
        <div className={styles.sh}>Top-of-Funnel Comparison</div>
        <div className={styles.tw}>
          <table className={styles.ct}>
            <thead>
              <tr>
                <th>Metric</th>
                <th className={styles.lhh}>
                  <Tip tip="Sun May 10 — Mini Lump Sum, Mother's Day.\nExpanded reactivation + Zoom enrollment change.\nAd spend adjusted ~$5,906 (12pm ET cutoff approx).\nSales partial — 1 deal confirmed at report pull.">
                    May 10 Sun ▴
                  </Tip>
                </th>
                <th>May 6 Wed</th>
                <th>May 3 Sun</th>
              </tr>
            </thead>
            <tbody>
              {TOP_OF_FUNNEL.map((r, i) =>
                r.kind === "divider" ? (
                  <tr key={i} className={styles.divRow}>
                    <td colSpan={4}>{r.label}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>
                      {r.tip ? <Tip tip={r.tip}>{r.label}</Tip> : r.label}
                    </td>
                    {r.values.map((v, j) => {
                      const cls = r.classes?.[j] ?? (j === 0 ? "lh" : "");
                      return (
                        <td key={j} className={classesFor(cls)}>
                          {renderValueCell(v, cls)}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.spendAdjNote}>
          * Ad spend adjustment: Thu $1,821 + Fri $1,732 + Sat $1,328 + 50% Sun $1,024 = ~$5,906. Mart figure $6,930 (full window). No hourly Meta data — 50% is an approximation for 12pm ET start. Hammer Them 2 (retargeting) excluded.
        </div>
        <div className={styles.fn}>
          <span className={styles.fnHi}>†</span> Other organic includes 2 Skool Community posts. <span className={styles.fnHi}>‡</span> May 10 Zoom enrollment = 4,160. Attend rate GHL basis 19.1% / Zoom basis 4.4%. ROAS &amp; CAC partial (1 deal) — evaluate Thursday midweek.
        </div>
      </section>

      {/* Channel mix */}
      <section className={styles.section}>
        <div className={styles.sh}>Channel Mix — May 10 Sun (960 GHL Registrants)</div>
        <div className={styles.twoCol}>
          <div>
            {CHANNEL_MIX_MAY10.map((c) => (
              <div className={styles.chRow} key={c.name}>
                <div className={styles.chName}>{c.name}</div>
                <div className={styles.chBg}>
                  <div
                    className={styles.chFill}
                    style={{ width: `${c.pct}%`, background: COLORS[c.color] }}
                  />
                </div>
                <div className={styles.chN}>{c.count}</div>
                <div className={styles.chP}>{c.pct.toFixed(1)}%</div>
              </div>
            ))}
            <div className={styles.fn}>
              Setter = 0 this cycle. Meta dependency highest in recent cycles at 89.7%. ManyChat down from 99 on May 6.
            </div>
          </div>
          <div>
            <div className={styles.sh} style={{ marginBottom: 12 }}>
              Channel Mix Trend
            </div>
            <div className={styles.tw}>
              <table className={styles.dt}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Channel</th>
                    <th className={styles.lhh}>May 10</th>
                    <th>May 6</th>
                    <th>May 3</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNEL_MIX_TREND.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className={`${styles.lh} ${r.dn ? styles.dn : ""}`}>
                        {r.may10}
                      </td>
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

      {/* Meta Campaigns */}
      <section className={styles.section}>
        <div className={styles.sh}>Meta Campaigns — Week of May 10 Promo Window</div>
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
                <td colSpan={6}>Lead-gen Total (excl. Hammer Them 2 retargeting)</td>
              </tr>
              <tr>
                <td>{META_CAMPAIGN_TOTAL.label}</td>
                <td>
                  <strong>{META_CAMPAIGN_TOTAL.spend}</strong>
                </td>
                <td>{META_CAMPAIGN_TOTAL.impr}</td>
                <td>{META_CAMPAIGN_TOTAL.clicks}</td>
                <td>{META_CAMPAIGN_TOTAL.conv}</td>
                <td>{META_CAMPAIGN_TOTAL.cpl}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          Full promo window total covers May 10 + upcoming May 13. Mart per-webinar attribution (~$5,906 adjusted) is source of truth for ROAS/CAC. Hammer Them 1: 0 conversions across all 3 tracked windows ($1,582 total). Hammer Them 2 (retargeting) excluded.
        </div>
        <br />
        <div className={styles.sh} style={{ marginBottom: 12 }}>
          Main Campaign CPL Trend
        </div>
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
                  <td className={`${styles.lh} ${classByFlag(r.may10Class)}`}>{r.may10}</td>
                  <td>{r.may3}</td>
                  <td className={classByFlag(r.apr26Class)}>{r.apr26}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          Main campaign CPL down 70% over 3 promo windows. GHL regs holding (800–960/webinar) — confirms genuine efficiency gain.
        </div>
      </section>

      {/* Reactivation */}
      <section className={styles.section}>
        <div className={styles.sh}>Reactivation Funnel</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Webinar</th>
                <th>
                  <Tip tip="No-show contacts targeted.\nMay 10 tag confirmed via raw_ghl:\nevent: no show-webinar-2026-05-06-mini-lump-sum-reactivation\nSource: mart_webinar_events.reactivation_pool_size">
                    Pool
                  </Tip>
                </th>
                <th>
                  <Tip tip="Pool contacts who attended.\nSource: mart_webinar_events.reactivations_attended">
                    Attended
                  </Tip>
                </th>
                <th>Attend Rate</th>
                <th>
                  <Tip tip="Pool contacts who booked a call within 7 days.\nSource: mart_webinar_events.reactivations_booked">
                    Booked
                  </Tip>
                </th>
                <th>Book Rate</th>
              </tr>
            </thead>
            <tbody>
              {REACTIVATION_FUNNEL.map((r) => (
                <tr key={r.webinar}>
                  <td className={r.highlight ? styles.lh : ""}>{r.webinar}</td>
                  <td className={r.highlight ? styles.lh : ""}>{r.pool}</td>
                  <td className={`${r.highlight ? styles.lh : ""} ${r.upAttended ? styles.up : ""}`}>
                    {r.attended}
                  </td>
                  <td className={r.highlight ? styles.lh : ""}>{r.attendRate}</td>
                  <td className={`${r.highlight ? styles.lh : ""} ${r.upBooked ? styles.up : ""}`}>
                    {r.booked}
                  </td>
                  <td className={r.highlight ? styles.lh : ""}>{r.bookRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          <span className={styles.fnHi}>†</span> GHL tag: <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10 }}>event: no show-webinar-2026-05-06-mini-lump-sum-reactivation</span>. 3,705 confirmed via raw_ghl. Mart now correctly picking up. Total Zoom enrollment 4,160 — ~505 of the 3,705 not enrolled in Zoom. Attend rate 2.3% vs standard 1.7–1.8% — slight lift from reminders. Book rate 19.8% of attended is strong.
        </div>
      </section>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  TAB 2 — Sales
// ════════════════════════════════════════════════════════════════════════

function Tab2() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sh}>Sales Funnel — Week May 3–9, 2026</div>
        <div className={styles.funnel}>
          {FUNNEL_STAGES.map((s, i) => {
            const conn = i < FUNNEL_CONNECTORS.length ? FUNNEL_CONNECTORS[i] : null;
            const color = COLORS[s.color as keyof typeof COLORS];
            const bgRgba = colorRgba(s.color, 0.09);
            const borderRgba = colorRgba(s.color, 0.22);
            return (
              <div key={s.label}>
                <div className={styles.fRow}>
                  <div
                    className={styles.fBar}
                    style={{
                      background: bgRgba,
                      border: `1px solid ${borderRgba}`,
                      width: `${s.width}%`,
                    }}
                  >
                    <span className={styles.fLabel} style={{ color }}>
                      <Tip tip={s.tip}>{s.label}</Tip>
                    </span>
                    <span className={styles.fVal} style={{ color }}>
                      {s.value}
                    </span>
                  </div>
                </div>
                {conn ? (
                  <div className={styles.fConn}>
                    <span
                      className={styles.fRate}
                      style={
                        conn.rateColor === "green"
                          ? { background: "rgba(74,222,128,.08)", color: "var(--green)" }
                          : undefined
                      }
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
          {KPI_CARDS.map((k) => (
            <div className={styles.kpi} key={k.label}>
              <div className={styles.kpiLbl}>
                <Tip tip={k.tip}>{k.label}</Tip>
              </div>
              <div className={styles.kpiVal}>{k.value}</div>
              <div className={`${styles.kpiCh} ${k.changeClass === "up" ? styles.up : k.changeClass === "dn" ? styles.dn : ""}`}>
                {k.change}
              </div>
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
                <th className={styles.lhh}>
                  <Tip tip="DATE(appointment_date_time) BETWEEN '2026-05-03' AND '2026-05-09'\nAll sales activity occurring this week.">
                    May 3–9
                  </Tip>
                </th>
                <th>
                  <Tip tip="DATE(appointment_date_time) BETWEEN '2026-04-26' AND '2026-05-02'\nSame appointment_date_time basis — like-for-like.">
                    Apr 26–May 2
                  </Tip>
                </th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {WOW_COMPARISON.map((r, i) =>
                r.kind === "divider" ? (
                  <tr key={i} className={styles.divRow}>
                    <td colSpan={4}>{r.label}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td>{r.tip ? <Tip tip={r.tip}>{r.label}</Tip> : r.label}</td>
                    <td className={classesFor(r.thisWeekClass ?? "lh")}>{r.thisWeek}</td>
                    <td>{r.prior}</td>
                    <td className={classByFlag(r.changeClass)}>{r.change}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          Both weeks on <strong>appointment_date_time basis</strong> — all call activity occurring within each calendar week, regardless of when the prospect originally booked. Consistent like-for-like comparison.
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Closer Performance — Per Webinar (booking_week_sun basis)</div>
        <div className={styles.twoCol}>
          <PerWebinarTable title="Sun May 3 Webinar" rows={PER_WEBINAR_MAY3} />
          <PerWebinarTable title="Wed May 6 Webinar" rows={PER_WEBINAR_MAY6} />
        </div>
        <div className={styles.fn}>
          Per-webinar tables use booking_week_sun basis — deals reflect what closed from each webinar&apos;s own booked pipeline only.
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sh}>Closer Performance — Overall (appointment_date_time May 3–9)</div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>
                  <Tip tip="All metrics COUNT DISTINCT prospect_email_lc\nDate filter: DATE(appointment_date_time) BETWEEN '2026-05-03' AND '2026-05-09'\nMatches Looker Studio int_calls_enriched view\nSource: int_calls_enriched">
                    Closer
                  </Tip>
                </th>
                <th><Tip tip="COUNT DISTINCT prospect_email_lc\nAll prospects with activity this week">Prospects</Tip></th>
                <th><Tip tip="Prospects (D'd)\nCOUNT DISTINCT WHERE is_dispositioned">Pros (D&apos;d)</Tip></th>
                <th><Tip tip="COUNT DISTINCT WHERE call_outcome='Setter DQ'">S.DQ</Tip></th>
                <th><Tip tip="COUNT DISTINCT WHERE call_outcome='Closer DQ'">C.DQ</Tip></th>
                <th><Tip tip="Prospects (SQ) — Setter-Qualified\nCOUNT DISTINCT WHERE is_show_rate_eligible">Pros (SQ)</Tip></th>
                <th><Tip tip="Shows (SQ) — Setter-Qualified Show-Ups\nCOUNT DISTINCT WHERE is_show_up">Shows (SQ)</Tip></th>
                <th><Tip tip="Shows (CQ) — Closer-Qualified Show-Ups\nCOUNT DISTINCT WHERE is_close_rate_eligible">Shows (CQ)</Tip></th>
                <th>Deals</th>
                <th>Cash</th>
                <th><Tip tip="Shows (SQ) / Prospects (SQ)">Show%</Tip></th>
                <th><Tip tip="Deals / Shows (CQ)">Close%</Tip></th>
              </tr>
            </thead>
            <tbody>
              {CLOSER_OVERALL.map((r) => (
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
              <tr className={styles.divRow}>
                <td colSpan={12}>Week Total</td>
              </tr>
              <tr>
                <td><strong>{CLOSER_OVERALL_TOTAL.label}</strong></td>
                <td>{CLOSER_OVERALL_TOTAL.prospects}</td>
                <td>{CLOSER_OVERALL_TOTAL.prosD}</td>
                <td>{CLOSER_OVERALL_TOTAL.sDQ}</td>
                <td>{CLOSER_OVERALL_TOTAL.cDQ}</td>
                <td>{CLOSER_OVERALL_TOTAL.prosSQ}</td>
                <td>{CLOSER_OVERALL_TOTAL.showsSQ}</td>
                <td>{CLOSER_OVERALL_TOTAL.showsCQ}</td>
                <td>{CLOSER_OVERALL_TOTAL.deals}</td>
                <td>{CLOSER_OVERALL_TOTAL.cash}</td>
                <td>{CLOSER_OVERALL_TOTAL.show}</td>
                <td>{CLOSER_OVERALL_TOTAL.close}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.fn}>
          All metrics on appointment_date_time basis — matches Looker Studio. Show% = Shows (SQ) / Prospects (SQ). Close% = Deals / Shows (CQ).
        </div>
        <br />
        <div className={styles.sh} style={{ marginBottom: 12 }}>
          WoW Closer Comparison
        </div>
        <div className={styles.tw}>
          <table className={styles.dt}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Closer</th>
                <th className={styles.lhh}>May 3–9 Deals</th>
                <th className={styles.lhh}>May 3–9 Cash</th>
                <th>
                  <Tip tip="Prior week figures on booking_week_sun='2026-04-26' basis.\nFull appt_date_time re-query for prior week per-closer pending.">
                    Apr 26–May 2 Deals †
                  </Tip>
                </th>
                <th>Apr 26–May 2 Cash †</th>
              </tr>
            </thead>
            <tbody>
              {CLOSER_WOW.map((r) => (
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
        <div className={styles.fn}>
          <span className={styles.fnHi}>†</span> Prior week per-closer is on booking_week_sun basis — week-level totals in WoW table above are on appt_date_time basis for both weeks.
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
                    <th><Tip tip="COUNT DISTINCT prospect_email_lc">Prospects</Tip></th>
                    <th><Tip tip="Prospects (SQ)\nCOUNT DISTINCT WHERE is_show_rate_eligible">Pros (SQ)</Tip></th>
                    <th><Tip tip="Shows (SQ)\nCOUNT DISTINCT WHERE is_show_up">Shows (SQ)</Tip></th>
                    <th><Tip tip="Shows (SQ) / Prospects (SQ)">Show%</Tip></th>
                    <th><Tip tip="Shows (CQ)\nCOUNT DISTINCT WHERE is_close_rate_eligible">Shows (CQ)</Tip></th>
                    <th>Deals</th>
                    <th>Cash</th>
                    <th><Tip tip="Deals / Shows (CQ)">Close%</Tip></th>
                  </tr>
                </thead>
                <tbody>
                  {BOOKING_MODE.map((r) => (
                    <tr key={r.source}>
                      <td>{r.tip ? <Tip tip={r.tip}>{r.source}</Tip> : r.source}</td>
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
            <div className={styles.fn}>
              appointment_date_time basis. Setter-booked show rate (71.4%) outperforms webinar-booked (64.7%). Webinar-booked close rate higher (44.4% vs 35.7%) once qualified. Cash nearly split: webinar $22,785 / setter $18,988.
            </div>
          </div>
          <div>
            <div className={styles.sh} style={{ marginBottom: 12 }}>
              Setter Performance — Prospects (SQ) &amp; Show Rate by Booking Mode
            </div>
            <div className={styles.tw}>
              <table className={styles.dt} style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Setter</th>
                    <th>Mode</th>
                    <th><Tip tip="Prospects (SQ) for this mode">Pros (SQ)</Tip></th>
                    <th><Tip tip="Shows (SQ) for this mode">Shows (SQ)</Tip></th>
                    <th><Tip tip="Shows (SQ) / Prospects (SQ) — per mode">Show%</Tip></th>
                    <th>Deals</th>
                    <th>Cash</th>
                    <th><Tip tip="$300/week bonus: 80%+ overall show rate AND 20+ Prospects (SQ)">Bonus</Tip></th>
                  </tr>
                </thead>
                <tbody>
                  {SETTER_PERF.map((s) => (
                    <SetterBlock key={s.name} setter={s} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.fn}>
              appointment_date_time basis. Bonus: 80%+ SR AND 20+ Pros (SQ). No setter qualified. Sal clears SR (85.7%) but volume short (7, post-trip). Swapnil has volume but SR 70%. Hania misses both — webinar-sourced SR 40% is the key concern.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function PerWebinarTable({
  title,
  rows,
}: {
  title: string;
  rows: typeof PER_WEBINAR_MAY3;
}) {
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
            {rows.map((r) => (
              <tr key={r.closer}>
                <td>{r.closer}</td>
                <td>{r.prospects}</td>
                <td>{r.prosSQ}</td>
                <td>{r.showsSQ}</td>
                <td>{r.showsCQ}</td>
                <td className={r.upDeals ? styles.up : r.dnDeals ? styles.dn : ""}>{r.deals}</td>
                <td className={r.upClose ? styles.up : r.dnClose ? styles.dn : r.ntClose ? styles.nt : ""}>{r.close}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetterBlock({ setter }: { setter: (typeof SETTER_PERF)[number] }) {
  const toneClass = setter.bonus.tone === "dn" ? styles.dn : setter.bonus.tone === "amb" ? styles.amb : "";
  return (
    <>
      {setter.rows.map((row, idx) => (
        <tr key={row.mode}>
          {idx === 0 ? (
            <td rowSpan={2} style={{ fontWeight: 600 }}>
              {setter.name}
            </td>
          ) : null}
          <td>{row.mode}</td>
          <td>{row.prosSQ}</td>
          <td>{row.showsSQ}</td>
          <td className={row.upShow ? styles.up : row.dnShow ? styles.dn : ""}>{row.show}</td>
          <td>{row.deals}</td>
          <td>{row.cash}</td>
          {idx === 0 ? (
            <td rowSpan={2} className={toneClass}>
              <Tip tip={setter.bonus.tip}>{setter.bonus.label}</Tip>
            </td>
          ) : null}
        </tr>
      ))}
      <tr className={styles.divRow}>
        <td colSpan={7}>{setter.combined}</td>
      </tr>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  TAB 3 — Insights
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
            ins.tone === "win"
              ? styles.insWin
              : ins.tone === "watch"
              ? styles.insWatch
              : ins.tone === "flag"
              ? styles.insFlag
              : ins.tone === "fix"
              ? styles.insFix
              : ins.tone === "fwd"
              ? styles.insFwd
              : styles.insCtx;
          const tagCls =
            ins.tone === "win"
              ? styles.insWinTag
              : ins.tone === "watch"
              ? styles.insWatchTag
              : ins.tone === "flag"
              ? styles.insFlagTag
              : ins.tone === "fix"
              ? styles.insFixTag
              : ins.tone === "fwd"
              ? styles.insFwdTag
              : styles.insCtxTag;
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

function classesFor(cls: string): string {
  if (!cls) return "";
  return cls
    .split(" ")
    .map((c) => {
      switch (c) {
        case "lh":
          return styles.lh;
        case "lhh":
          return styles.lhh;
        case "up":
          return styles.up;
        case "dn":
          return styles.dn;
        case "nt":
          return styles.nt;
        case "amb":
          return styles.amb;
        case "tag-p":
          return styles.tagP;
        case "tag-g":
          return styles.tagG;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join(" ");
}

function renderValueCell(value: string, cls: string) {
  if (cls.includes("tag-p")) return <span className={styles.tagP}>{value}</span>;
  if (cls.includes("tag-g")) return <span className={styles.tagG}>{value}</span>;
  return value;
}

function classByFlag(flag: string | undefined) {
  if (!flag) return "";
  if (flag === "up") return styles.up;
  if (flag === "dn") return styles.dn;
  if (flag === "nt") return styles.nt;
  return "";
}

function colorRgba(name: string, alpha: number): string {
  const map: Record<string, [number, number, number]> = {
    blue: [96, 165, 250],
    green: [74, 222, 128],
    amber: [251, 191, 36],
    red: [248, 113, 113],
    purple: [167, 139, 250],
  };
  const c = map[name] ?? map.blue;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}
