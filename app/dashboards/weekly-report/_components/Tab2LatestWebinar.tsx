import type { ReactNode } from "react";
import type { WebinarComparisonRowV2, MetaCampaignRow } from "@/lib/weekly-report-bq-v2";
import { getResolvedSql, type SqlCtx } from "@/lib/dev-sql";
import { TIP } from "@/lib/metric-tips";
import {
  getTrafficLight,
  trafficLightColor,
  type ThresholdKey,
} from "@/lib/metric-thresholds";
import { ContextBannerEditor } from "./ContextBannerEditor";
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

export type Tab2LatestWebinarProps = {
  webinars: WebinarComparisonRowV2[];                 // latest first
  metaCampaigns: MetaCampaignRow[];
  inProgress: boolean;                                  // is the latest column still mid-cycle?
  snapshotSlug: string;
  canEdit: boolean;
  contextBanner: { tag: string; title: string; body: string };
  devMode?: boolean;
  sqlCtx?: SqlCtx;
};

export function Tab2LatestWebinar({
  webinars,
  metaCampaigns,
  inProgress,
  snapshotSlug,
  canEdit,
  contextBanner,
  devMode = false,
  sqlCtx,
}: Tab2LatestWebinarProps) {
  const headers = [
    webinars[0]?.webinarDate ?? "—",
    webinars[1]?.webinarDate ?? "—",
    webinars[2]?.webinarDate ?? "—",
  ];

  const comparisonSql = devMode && sqlCtx ? getResolvedSql("webinarComparison", sqlCtx) : null;
  const metaSql = devMode && sqlCtx ? getResolvedSql("metaCampaigns", sqlCtx) : null;

  return (
    <>
      {/* 1. Info banner when latest is in-progress */}
      {inProgress ? (
        <div className={styles.bannerInfo}>
          <span className={styles.bIcon}>ℹ</span>
          <p>
            Sales calls for <strong>{headers[0]}</strong> are mid-cycle. Partial downstream
            metrics (shows, deals, cash) carry a <span className={styles.tagP}>partial</span> tag.
            ROAS, CAC, and cost-per-deal are hidden until the booking window closes.
          </p>
        </div>
      ) : null}

      {/* 2. Operational Context banner (admin-editable, AI-fillable) */}
      <ContextBannerEditor
        snapshotSlug={snapshotSlug}
        initialTag={contextBanner.tag}
        initialTitle={contextBanner.title}
        initialBody={contextBanner.body}
        canEdit={canEdit}
        kind="context"
      />

      {/* 3. Top-of-Funnel Comparison */}
      <section className={styles.section}>
        <div className={styles.sh}>Top-of-Funnel Comparison{comparisonSql ? <SqlInfoButton resolved={comparisonSql} /> : null}</div>
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
              <DivRow>Registration</DivRow>
              <DataRow label="Ad Spend" values={webinars.map((w) => fmtUsd(w.totalWebinarAdSpend))} tip={TIP.adSpendMart} />
              <DataRow label="LP Page Views" values={webinars.map((w) => fmtInt(w.lpPageViews))} tip={TIP.lpPageViews} />
              <DataRow label="LP Opt-Ins" values={webinars.map((w) => fmtInt(w.lpOptIns))} tip={TIP.lpOptIns} />
              <DataRow label="LP Opt-in Rate" values={webinars.map((w) => fmtPct(w.lpOptInRate))} tip={TIP.lpOptInRate} trafficKey="lpOptInRate" rawValues={webinars.map((w) => w.lpOptInRate)} />
              <DataRow label="Total Registrants" values={webinars.map((w) => fmtInt(w.totalRegistrants))} tip={TIP.totalRegistrantsGhl} />
              <DataRow label="↳ Meta" values={webinars.map((w) => fmtInt(w.metaRegistrants))} />
              <DataRow label="↳ ManyChat" values={webinars.map((w) => fmtInt(w.manychatRegistrants))} />
              <DataRow label="↳ Setter" values={webinars.map((w) => fmtInt(w.setterRegistrants))} />
              <DataRow label="↳ Other organic" values={webinars.map((w) => fmtInt(w.otherOrganicRegistrants))} />

              <DivRow>Attendance</DivRow>
              <DataRow label="Unique Attendees" values={webinars.map((w) => fmtInt(w.uniqueAttendees))} tip={TIP.uniqueAttendees} />
              <DataRow label="Pitched (>25 min)" values={webinars.map((w) => fmtInt(w.pitchedAttendees))} tip={TIP.pitchedAttendees} />
              <DataRow label="Attend Rate (Zoom/Reg)" values={webinars.map((w) => fmtPct(w.regToAttendRate))} tip={TIP.attendRateRegToZoom} trafficKey="webinarShowUpRate" rawValues={webinars.map((w) => w.regToAttendRate)} />
              <DataRow label="Pitch Rate" values={webinars.map((w) => fmtPct(w.attendToPitchedRate))} tip={TIP.pitchRate} />

              <DivRow>Meta Funnel · Registration Campaigns Only</DivRow>
              <DataRow label="Meta Impressions" values={webinars.map((w) => fmtInt(w.metaImpressions))} tip={TIP.metaImpressions} />
              <DataRow label="Meta Link Clicks" values={webinars.map((w) => fmtInt(w.metaLinkClicks))} tip={TIP.metaLinkClicks} />
              <DataRow label="Meta CTR (link)" values={webinars.map((w) => fmtPct(w.metaCtr))} tip={TIP.metaCtr} />
              <DataRow label="Meta Reported Conv." values={webinars.map((w) => fmtInt(w.metaReportedConversions))} tip={TIP.metaReportedConv} />
              <DataRow label="Meta CVR (link)" values={webinars.map((w) => fmtPct(w.metaCvr))} tip={TIP.metaCvr} />
              <DataRow label="Meta CPL" values={webinars.map((w) => fmtUsd2(w.metaCpl))} tip={TIP.metaCpl} />

              <DivRow>Cost Efficiency</DivRow>
              <DataRow label="Cost / Reg (Paid)" values={webinars.map((w) => fmtUsd2(w.paidCpr))} tip={TIP.costPerRegPaid} trafficKey="costPerRegistrant" rawValues={webinars.map((w) => w.paidCpr)} />
              <DataRow label="Cost / Attendee" values={webinars.map((w) => fmtUsd2(w.blendedCpa))} tip={TIP.costPerAttendee} />
              <DataRow label="Cost / Booked Call" values={webinars.map((w) => fmtUsd2(w.blendedCpbc))} tip={TIP.costPerBookedCall} trafficKey="costPerBookedCall" rawValues={webinars.map((w) => w.blendedCpbc)} />
              <DataRow label="Cost / Active Booked Call" values={webinars.map((w) => fmtUsd2(w.blendedCpbcActive))} tip={TIP.costPerActiveBookedCall} />
              <DataRow
                label="Cost / Qualified Show"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress ? naCell() : fmtUsd2(w.blendedCostPerQualifiedShow),
                )}
                tip={TIP.costPerQualifiedShow}
              />

              <DivRow>Sales — Webinar-Attributed</DivRow>
              <DataRow
                label="Calls Booked"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress ? partial(fmtInt(w.callsBooked)) : fmtInt(w.callsBooked),
                )}
                tip={TIP.callsBookedTotal}
              />
              <DataRow label="Active Calls Booked" values={webinars.map((w) => fmtInt(w.callsBookedActive))} tip={TIP.callsBookedActive} />
              <DataRow
                label="Shows"
                values={webinars.map((w, i) => (i === 0 && inProgress ? partial(fmtInt(w.shows)) : fmtInt(w.shows)))}
                tip={TIP.showsHeld}
              />
              <DataRow
                label="Qualified Shows"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress ? partial(fmtInt(w.qualifiedShows)) : fmtInt(w.qualifiedShows),
                )}
                tip={TIP.funnelQualifiedShows}
              />
              <DataRow
                label="Deals"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress ? partial(fmtInt(w.dealsClosed)) : fmtInt(w.dealsClosed),
                )}
                tip={TIP.dealsCycle}
              />
              <DataRow
                label="Cash"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress ? partial(fmtUsd(w.cashCollected)) : fmtUsd(w.cashCollected),
                )}
                tip={TIP.cashCollected}
              />
              <DataRow
                label="Cash Collected / Attendee"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress
                    ? partial(fmtUsd2(w.cashCollectedPerAttendee))
                    : fmtUsd2(w.cashCollectedPerAttendee),
                )}
                tip={TIP.cashCollectedPerAttendee}
              />
              <DataRow
                label="Contract Value / Attendee"
                values={webinars.map((w, i) =>
                  i === 0 && inProgress
                    ? partial(fmtUsd2(w.contractValuePerAttendee))
                    : fmtUsd2(w.contractValuePerAttendee),
                )}
                tip={TIP.contractValuePerAttendee}
              />
              <DataRow
                label="ROAS (Cash)"
                values={webinars.map((w, i) => (i === 0 && inProgress ? naCell() : fmtX(w.roasCash)))}
                tip={TIP.roasCash}
                trafficKey="roas"
                rawValues={webinars.map((w, i) => (i === 0 && inProgress ? null : w.roasCash))}
              />
              <DataRow
                label="ROAS (Revenue/TCV)"
                values={webinars.map((w, i) => (i === 0 && inProgress ? naCell() : fmtX(w.roasRevenue)))}
                trafficKey="roas"
                rawValues={webinars.map((w, i) => (i === 0 && inProgress ? null : w.roasRevenue))}
              />
              <DataRow
                label="CAC"
                values={webinars.map((w, i) => (i === 0 && inProgress ? naCell() : fmtUsd2(w.cac)))}
              />
            </tbody>
          </table>
        </div>
        {inProgress ? (
          <div className={styles.fn}>
            <span className={styles.hi}>*</span> Latest-column ROAS/CAC/Cost-per-Deal hidden while
            the sales window is still open. Downstream sales metrics tagged{" "}
            <span className={styles.tagP}>partial</span> until cycle closes.
          </div>
        ) : null}
      </section>

      {/* 4. Channel Mix (latest webinar only, bars) */}
      {webinars[0] ? <ChannelMixBars webinar={webinars[0]} /> : null}

      {/* 5. Channel Mix Trend (3-webinar comparison table) */}
      <ChannelMixTrend webinars={webinars} headers={headers} />

      {/* 6. Meta Campaigns */}
      <MetaCampaignsTable campaigns={metaCampaigns} sqlInfo={metaSql} />

      {/* 7. Reactivation Funnel */}
      <ReactivationFunnel webinars={webinars} headers={headers} />

      {/* 8. Warning banner — ad-spend cutoff */}
      <div className={styles.bannerWarn}>
        Ad-spend attribution for the latest column uses an approximated cutoff (Meta returns
        daily-grain only). Exact spend reconciles in the next-day refresh.
      </div>
    </>
  );
}

// Helper components

function DataRow({
  label,
  values,
  tip,
  trafficKey,
  rawValues,
}: {
  label: string;
  values: (string | ReactNode)[];
  tip?: string;
  /** If set, colors each cell green/orange/red using THRESHOLDS[trafficKey]. */
  trafficKey?: ThresholdKey;
  /** Raw numeric values aligned to `values` for threshold checks. */
  rawValues?: (number | null)[];
}) {
  return (
    <tr>
      <td data-tip={tip} style={tip ? { cursor: "help" } : undefined}>{label}</td>
      {values.map((v, i) => {
        const light = trafficKey ? getTrafficLight(rawValues?.[i] ?? null, trafficKey) : "neutral";
        const lhClass = i === 0 ? styles.lh : "";
        const color = trafficLightColor(light);
        return (
          <td key={i} className={lhClass} style={color ? { color, fontWeight: 600 } : undefined}>
            {v}
          </td>
        );
      })}
    </tr>
  );
}

function DivRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className={styles.divRow}>
      <td colSpan={4}>{children}</td>
    </tr>
  );
}

function partial(value: string): ReactNode {
  return <span className={styles.tagP}>{value} (partial)</span>;
}

function naCell(): ReactNode {
  return <span className={styles.naCell}>—</span>;
}

function ChannelMixBars({ webinar }: { webinar: WebinarComparisonRowV2 }) {
  const total = webinar.totalRegistrants || 1;
  const channels = [
    { name: "Meta paid", count: webinar.metaRegistrants, color: "var(--blue)" },
    { name: "Other organic", count: webinar.otherOrganicRegistrants, color: "var(--green)" },
    { name: "ManyChat", count: webinar.manychatRegistrants, color: "var(--amber)" },
    { name: "Setter", count: webinar.setterRegistrants, color: "var(--purple)" },
  ].filter((c) => c.count > 0);
  return (
    <section className={styles.section}>
      <div className={styles.sh}>
        Channel Mix — {webinar.webinarDate} · {fmtInt(webinar.totalRegistrants)} registrants
      </div>
      {channels.map((c) => (
        <div className={styles.chRow} key={c.name}>
          <div className={styles.chName}>{c.name}</div>
          <div className={styles.chBg}>
            <div
              className={styles.chFill}
              style={{ width: `${(c.count / total) * 100}%`, background: c.color }}
            />
          </div>
          <div className={styles.chN}>{fmtInt(c.count)}</div>
          <div className={styles.chP}>{((c.count / total) * 100).toFixed(2)}%</div>
        </div>
      ))}
    </section>
  );
}

function ChannelMixTrend({ webinars, headers }: { webinars: WebinarComparisonRowV2[]; headers: string[] }) {
  const channels: { name: string; field: keyof WebinarComparisonRowV2 }[] = [
    { name: "Meta paid", field: "metaRegistrants" },
    { name: "Other organic", field: "otherOrganicRegistrants" },
    { name: "ManyChat", field: "manychatRegistrants" },
    { name: "Setter", field: "setterRegistrants" },
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Channel Mix Trend — 3-Webinar Comparison</div>
      <div className={styles.tw}>
        <table className={styles.dt}>
          <thead>
            <tr>
              <th>Channel</th>
              <th className={styles.lhh}>{headers[0]}</th>
              <th>{headers[1]}</th>
              <th>{headers[2]}</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr key={ch.name}>
                <td>{ch.name}</td>
                {webinars.map((w, i) => {
                  const count = (w[ch.field] as number) || 0;
                  const total = w.totalRegistrants || 1;
                  return (
                    <td key={i} className={i === 0 ? styles.lh : ""}>
                      {fmtPct(count / total, 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetaCampaignsTable({ campaigns, sqlInfo }: { campaigns: MetaCampaignRow[]; sqlInfo?: import("@/lib/dev-sql").ResolvedMetricSql | null }) {
  if (campaigns.length === 0) return null;
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Meta Campaigns — Promo Window{sqlInfo ? <SqlInfoButton resolved={sqlInfo} /> : null}</div>
      <div className={styles.tw}>
        <table className={styles.dt}>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Category</th>
              <th>Spend</th>
              <th>Impr.</th>
              <th>Link Clicks</th>
              <th>Freq.</th>
              <th>Conv.</th>
              <th>CPL</th>
              <th>CTR (link)</th>
              <th>CVR (link)</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const isHt = c.campaignCategory === "webinar_hammer_them";
              const freqHigh = (c.frequencyWindow ?? 0) > 5;
              const catTag = isHt ? styles.tagR : styles.tagB;
              return (
                <tr key={c.campaignName}>
                  <td>{c.campaignName}</td>
                  <td>
                    <span className={catTag}>{isHt ? "ht" : "reg"}</span>
                  </td>
                  <td className={isHt ? styles.amb : ""}>{fmtUsd2(c.spend)}</td>
                  <td>{fmtInt(c.impressions)}</td>
                  <td>{fmtInt(c.linkClicks)}</td>
                  <td className={freqHigh ? styles.amb : ""}>
                    {c.frequencyWindow == null ? "—" : `${c.frequencyWindow.toFixed(2)}×`}
                  </td>
                  <td>{fmtInt(c.conversions)}</td>
                  <td>{fmtUsd2(c.cpl)}</td>
                  <td>{fmtPct(c.linkCtr, 2)}</td>
                  <td>{fmtPct(c.linkCvr, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.fn}>
        Frequency = SUM(impressions) / MAX(daily reach). &gt;3× = saturation risk, &gt;5× = high saturation.
      </div>
    </section>
  );
}

function ReactivationFunnel({ webinars, headers }: { webinars: WebinarComparisonRowV2[]; headers: string[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.sh}>Reactivation Funnel</div>
      <div className={styles.tw}>
        <table className={styles.dt}>
          <thead>
            <tr>
              <th>Webinar</th>
              <th>Pool</th>
              <th>Attended</th>
              <th>Attend Rate</th>
              <th>Booked</th>
              <th>Book Rate</th>
            </tr>
          </thead>
          <tbody>
            {webinars.map((w, i) => {
              const attendRate = w.reactivationPoolSize > 0 ? w.reactivationsAttended / w.reactivationPoolSize : null;
              const bookRate = w.reactivationsAttended > 0 ? w.reactivationsBooked / w.reactivationsAttended : null;
              return (
                <tr key={w.webinarDate}>
                  <td>{headers[i]}</td>
                  <td className={i === 0 ? styles.lh : ""}>{fmtInt(w.reactivationPoolSize)}</td>
                  <td className={i === 0 ? styles.lh : ""}>{fmtInt(w.reactivationsAttended)}</td>
                  <td className={i === 0 ? styles.lh : ""}>{fmtPct(attendRate)}</td>
                  <td className={i === 0 ? styles.lh : ""}>{fmtInt(w.reactivationsBooked)}</td>
                  <td className={i === 0 ? styles.lh : ""}>{fmtPct(bookRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
