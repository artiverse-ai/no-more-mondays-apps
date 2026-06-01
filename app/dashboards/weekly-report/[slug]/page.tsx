import { notFound } from "next/navigation";
import { DevModeToggle } from "@/components/DevModeToggle";
import { getCurrentUser } from "@/lib/auth";
import { getDevMode } from "@/lib/dev-mode";
import { getAllResolvedSql } from "@/lib/dev-sql";
import { DownloadAllSqlButton } from "../_components/DownloadAllSqlButton";
import {
  MARKETING_EDITOR,
  SALES_EDITOR,
  listSolutions,
} from "@/lib/weekly-report-solutions";
import {
  fetchKpiStrip,
  fetchSectionA,
  fetchSectionATab3Closer,
  fetchSectionB,
  fetchSectionC,
  fetchWebinarComparisonV2,
  fetchMetaCampaigns,
  fetchCloserOverallExtended,
  fetchSetterOverall,
  fetchSetterByMode,
  fetchBookingModeExtended,
  fetchMonthlyWorkshopBreakdown,
  fetchRecentWebinarDates,
  comparisonDatesForMode,
  metaPromoWindow,
  type MonthlyWorkshopBreakdown,
} from "@/lib/weekly-report-bq-v2";
import { getSnapshot, findWorkshopSnapshotByDate, listInsights, type Insight, type Snapshot } from "@/lib/weekly-report-snapshots";
import { InsightsEditor, type EditableInsight } from "../_components/InsightsEditor";
import { PersistentKpiStrip } from "../_components/PersistentKpiStrip";
import { TopMetrics } from "../_components/TopMetrics";
import { getForecastBundleForWindow } from "@/lib/forecast";
import { SolutionsTab } from "../_components/SolutionsTab";
import { Tab1Overview } from "../_components/Tab1Overview";
import { Tab2LatestWebinar } from "../_components/Tab2LatestWebinar";
import { Tab3LastWeekSales } from "../_components/Tab3LastWeekSales";
import { Tabs } from "../_components/Tabs";
import { TooltipLayer } from "../_components/Tooltip";
import styles from "../_components/report.module.css";

export const metadata = {
  title: "Weekly Report · No More Mondays",
};

// Re-fetch on every request — BQ data moves as deals close.
export const revalidate = 0;

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const me = await getCurrentUser();

  const snapshot = await getSnapshot(slug);
  if (!snapshot) notFound();

  const reportType = snapshot.reportType;
  const isAdmin = Boolean(me?.isAdmin);
  const devMode = await getDevMode();

  // The KPI window for both Monday and Thursday is the prev Sun-Sat. Per
  // spec §1: for Thursday, this is the same week Monday's report covered
  // (the just-closed week ending the Saturday before latest_wed).
  const { kpiStart, kpiEnd, latestWebinarDate } = computeWindows(snapshot.weekStart, snapshot.weekEnd, reportType);

  // Marketing week (Mon-Sun) — anchored on the Mon-Sun containing the
  // latest webinar. Used for webinar/marketing-source metrics so the
  // window always wraps the focus webinar instead of ending one day
  // before it (the sales-week problem). See computeMarketingWindow below.
  const { mwStart, mwEnd } = computeMarketingWindow(latestWebinarDate);

  // Comparison IN-list per spec §7 — depends on report type. For
  // monthly workshops we pull the last 3 ACTUAL events (any type) from
  // mart_webinar_events so the comparison columns line up with whatever
  // ran most recently (workshop, Sunday webinar, Wed webinar — mixed).
  const compDates = reportType === "monthly_workshop_recap"
    ? await fetchRecentWebinarDates(latestWebinarDate, 3)
    : comparisonDatesForMode(latestWebinarDate, reportType);

  // Promo window for the Meta campaigns table — 4 days ending on latest.
  const promoWindow = metaPromoWindow(latestWebinarDate, reportType);

  // Prior week (Sun-Sat) for WoW comparison — Monday only fetches this.
  const priorWeekStart = addDays(kpiStart, -7);
  const priorWeekEnd = addDays(kpiEnd, -7);
  const isMonday = reportType === "weekly_recap";
  // Show the "Last Week's Sales" tab on Monday recaps AND monthly
  // workshop recaps (both run on a Monday and need the sales view).
  const showSalesTab = isMonday || reportType === "monthly_workshop_recap";

  // Parallel fetch of every data source the dashboard needs. Monday +
  // monthly-workshop pull the Tab 3 fetchers; Thursday skips them.
  const [
    kpiStrip,
    sectionA,
    sectionC,
    webinars,
    metaCampaigns,
    insights,
    mktSolutions,
    salesSolutions,
    priorWeekFunnel,
    closerOverall,
    setterOverall,
    setterByMode,
    bookingMode,
    sectionATab3,
  ] = await Promise.all([
    fetchKpiStrip(kpiStart, kpiEnd, latestWebinarDate, mwStart, mwEnd),
    fetchSectionA(kpiStart, kpiEnd),
    fetchSectionC(kpiStart, kpiEnd),
    fetchWebinarComparisonV2(compDates),
    fetchMetaCampaigns(promoWindow.start, promoWindow.end),
    listInsights(slug),
    listSolutions(slug, "marketing").catch(() => []),
    listSolutions(slug, "sales").catch(() => []),
    showSalesTab ? fetchSectionC(priorWeekStart, priorWeekEnd) : Promise.resolve(null),
    showSalesTab ? fetchCloserOverallExtended(kpiStart, kpiEnd) : Promise.resolve([]),
    showSalesTab ? fetchSetterOverall(kpiStart, kpiEnd) : Promise.resolve([]),
    showSalesTab ? fetchSetterByMode(kpiStart, kpiEnd) : Promise.resolve([]),
    showSalesTab ? fetchBookingModeExtended(kpiStart, kpiEnd) : Promise.resolve([]),
    fetchSectionATab3Closer(kpiStart, kpiEnd),   // both report types — needed for AOV everywhere (Fanbasis AOV is meaningless)
  ]);

  // Section B needs the KPI strip values (Cash/Booked, Show Rate, CPL) — compute after.
  const sectionB = await fetchSectionBData(kpiStart, kpiEnd, kpiStrip);

  // ── Monthly Workshop overrides — applies when reportType ===
  // 'monthly_workshop_recap'. The latest column uses the page snapshot's
  // workshop config. Historical comparison columns (W-1, W-2) ALSO get
  // overridden if there's a matching monthly_workshop_recap snapshot in
  // BQ for that date — so the cost rows + reactivation funnel render
  // the same numbers those reports' own pages would.
  //
  // Windows derived from each workshop's workshopTagDate:
  //  - regWindow:   14 days before workshop → workshop day + 1 (exclusive)
  //  - promoWindow: Wed before workshop → workshop day (inclusive)
  //  - salesWindow: promo start → workshop day + 6 (post-workshop bookings)
  //
  // Ad spend is queried dynamically from stg_meta_campaigns unless the
  // snapshot has total_ad_spend_override set (manual catch-all for when
  // campaign categorization in BQ undercounts real workshop spend).
  // total spend = adSpend + reactivationCost from each snapshot.
  async function fetchWorkshopOverride(s: Snapshot): Promise<MonthlyWorkshopBreakdown | undefined> {
    if (!s.workshopTagDate) return undefined;
    const wsDate = s.workshopTagDate;
    const promoStart  = addDays(wsDate, -4);
    const promoEnd    = wsDate;
    const regStart    = addDays(wsDate, -14);
    const regEnd      = addDays(wsDate, 1);
    const salesStart  = promoStart;
    const salesEnd    = addDays(wsDate, 6);
    const emailTag = s.retargetingEmailTag ?? `retargeting: email: workshop-${wsDate}`;
    const smsTag   = s.retargetingSmsTag   ?? `retargeting: sms: workshop-${wsDate}`;
    const tags = [emailTag, smsTag].filter(Boolean);

    const br = await fetchMonthlyWorkshopBreakdown(
      wsDate, regStart, regEnd, promoStart, promoEnd, salesStart, salesEnd, tags,
    ).catch(() => undefined);
    if (!br) return undefined;

    const reactivationCost = s.reactivationCost ?? 0;
    // Use manual ad-spend override when set, otherwise the dynamic
    // stg_meta_campaigns sum.
    const adSpend          = s.totalAdSpendOverride ?? br.totalAdSpend;
    const totalSpend       = adSpend + reactivationCost;
    const conversions      = br.metaReportedConversions;
    br.reactivationCost = reactivationCost;
    br.totalAdSpend     = adSpend;
    br.totalSpend       = totalSpend;
    br.regAdSpend       = totalSpend;
    br.metaCpl          = conversions > 0 ? totalSpend / conversions : null;
    return br;
  }

  let monthlyWorkshopOverride: MonthlyWorkshopBreakdown | undefined;
  let reactivationNote: string | undefined;
  // Map of webinar_date → workshop override. Tab 2 looks up each
  // comparison column by date; columns without a workshop snapshot
  // (e.g. Wed/Sun webinars) just use mart_webinar_events.
  const historicalWorkshopOverrides = new Map<string, MonthlyWorkshopBreakdown>();

  if (snapshot.reportType === "monthly_workshop_recap" && snapshot.workshopTagDate) {
    monthlyWorkshopOverride = await fetchWorkshopOverride(snapshot);
    // When the team uses the regular webinar form for a workshop, the
    // mart_webinar_events row IS accurate — overlay its registrant
    // values onto the override so Tab 2's Total Registrants + per-channel
    // rows match the bottom Channel Mix bar chart (which reads the mart).
    if (monthlyWorkshopOverride && snapshot.useMartRegistrants) {
      const m = webinars[0];
      if (m) {
        monthlyWorkshopOverride.total        = m.totalRegistrants;
        monthlyWorkshopOverride.meta         = m.metaRegistrants;
        monthlyWorkshopOverride.manychat     = m.manychatRegistrants;
        monthlyWorkshopOverride.setter       = m.setterRegistrants;
        monthlyWorkshopOverride.otherOrganic = m.otherOrganicRegistrants;
        monthlyWorkshopOverride.whatsapp     = 0;
        monthlyWorkshopOverride.email        = 0;
      }
    }
    if (monthlyWorkshopOverride) {
      historicalWorkshopOverrides.set(snapshot.workshopTagDate, monthlyWorkshopOverride);
    }
    // Also look up historical workshop snapshots for the comparison
    // columns. The compDates here are webinar_date values from
    // mart_webinar_events; we cross-reference to weekly_report_snapshots
    // by workshop_tag_date.
    const historicalDates = compDates.filter((d) => d !== snapshot.workshopTagDate);
    if (historicalDates.length > 0) {
      const historicalSnapshots = await Promise.all(
        historicalDates.map((d) => findWorkshopSnapshotByDate(d)),
      );
      const histOverrides = await Promise.all(
        historicalSnapshots.map((s) => (s ? fetchWorkshopOverride(s) : Promise.resolve(undefined))),
      );
      historicalSnapshots.forEach((s, i) => {
        const ovr = histOverrides[i];
        if (!s?.workshopTagDate || !ovr) return;
        // Match the latest-column behavior: if THIS workshop's snapshot
        // says useMartRegistrants, replace the override's registrant
        // values with the matching mart row's so Tab 2 cells line up.
        if (s.useMartRegistrants) {
          const m = webinars.find((w) => w.webinarDate === s.workshopTagDate);
          if (m) {
            ovr.total        = m.totalRegistrants;
            ovr.meta         = m.metaRegistrants;
            ovr.manychat     = m.manychatRegistrants;
            ovr.setter       = m.setterRegistrants;
            ovr.otherOrganic = m.otherOrganicRegistrants;
            ovr.whatsapp     = 0;
            ovr.email        = 0;
          }
        }
        historicalWorkshopOverrides.set(s.workshopTagDate, ovr);
      });
    }
    const wsDate = snapshot.workshopTagDate;
    const emailTag = snapshot.retargetingEmailTag ?? `retargeting: email: workshop-${wsDate}`;
    const smsTag   = snapshot.retargetingSmsTag   ?? `retargeting: sms: workshop-${wsDate}`;
    reactivationNote =
      `Reactivation pool = contacts tagged \`${emailTag}\` OR \`${smsTag}\` ` +
      "(union — anyone we reached on either channel). " +
      `Attended uses \`status: attended-workshop-${wsDate}\`; booked counts ` +
      `live-webinar calls scheduled ${addDays(wsDate, -4)} → ${addDays(wsDate, 6)}. ` +
      "Channel attribution (which message drove which book) isn't broken out.";
  }

  // Forecast targets (null-safe — returns all nulls if forecast_targets is
  // empty or no forecast covers this window). Failure is non-fatal.
  const forecast = await getForecastBundleForWindow(kpiStart, kpiEnd).catch(() => null);

  // Determine if the latest column is in-progress. Today: yes only when the
  // latest webinar date == snapshot.run_on date (Thursday → today's Wed
  // hasn't fully booked out yet). For weekly_recap (Monday) the latest_sun
  // is 1 day before run_on, so the cycle isn't in-progress in the same way,
  // but we still treat it as partial if total cash collected is 0 (sales
  // haven't landed yet).
  const inProgress = reportType === "midweek_check";

  const weekLabel = `${snapshot.weekLabel}`;
  const contextBanner = {
    tag: snapshot.contextTag ?? "",
    title: snapshot.contextTitle ?? "",
    body: snapshot.contextBody ?? "",
  };

  // Tab definitions. Monday's full layout per monday_report_build_guide.md §8:
  // 6 tabs (Overview / Latest Webinar / Last Week's Sales / AI Insights /
  // Marketing Solutions / Sales Solutions). Thursday: 5 tabs (no Last
  // Week's Sales — sales for the Wed cycle aren't in yet). Solutions
  // tabs preserved on both per user feedback memory.
  type TabDef = { id: string; label: string };
  const latestWebinarLabel =
    reportType === "midweek_check"          ? "Latest Webinar (Wed)" :
    reportType === "monthly_workshop_recap" ? "Latest Workshop" :
                                              "Latest Webinar";
  const tabs: TabDef[] = showSalesTab
    ? [
        { id: "t1", label: "Overview" },
        { id: "t2", label: latestWebinarLabel },
        { id: "t3sales", label: "Last Week's Sales" },
        { id: "t4ai", label: "AI Strategic Insights" },
        { id: "t5", label: "Marketing Solutions" },
        { id: "t6", label: "Sales Solutions" },
      ]
    : [
        { id: "t1", label: "Overview" },
        { id: "t2", label: latestWebinarLabel },
        { id: "t4ai", label: "AI Strategic Insights" },
        { id: "t5", label: "Marketing Solutions" },
        { id: "t6", label: "Sales Solutions" },
      ];

  const sqlCtx = {
    kpiStart,
    kpiEnd,
    latestWebinarDate,
    mwStart,
    mwEnd,
    comparisonDates: compDates,
    promoStart: promoWindow.start,
    promoEnd: promoWindow.end,
    priorWeekStart: showSalesTab ? priorWeekStart : undefined,
    priorWeekEnd: showSalesTab ? priorWeekEnd : undefined,
  };
  const sqlBundle = devMode && isAdmin ? getAllResolvedSql(sqlCtx) : "";
  const sqlFilename = `nmm-weekly-${slug}-${kpiStart}_${kpiEnd}.sql`;

  const panels: Record<string, React.ReactNode> = {
    t1: <Tab1Overview weekLabel={weekLabel} sectionA={sectionA} sectionATab3={sectionATab3} sectionB={sectionB} sectionC={sectionC} devMode={devMode && isAdmin} sqlCtx={sqlCtx} />,
    t2: (
      <Tab2LatestWebinar
        webinars={webinars}
        metaCampaigns={metaCampaigns}
        inProgress={inProgress}
        snapshotSlug={slug}
        canEdit={isAdmin}
        contextBanner={contextBanner}
        devMode={devMode && isAdmin}
        sqlCtx={sqlCtx}
        monthlyWorkshopOverride={monthlyWorkshopOverride}
        reactivationNote={reactivationNote}
        historicalWorkshopOverrides={Object.fromEntries(historicalWorkshopOverrides)}
      />
    ),
    t4ai: (
      <>
        <div className={styles.aiBadge}>
          🤖 Generated by AI · Claude · {snapshot.insightsGeneratedAt?.slice(0, 10) ?? "—"}
        </div>
        <InsightsEditor
          snapshotSlug={slug}
          weekLabel={snapshot.weekLabel}
          latestWebinar={snapshot.latestWebinar}
          canEdit={isAdmin}
          initial={insights as EditableInsight[]}
          initialStatus={snapshot.insightsGenerationStatus}
          initialError={snapshot.insightsGenerationError}
        />
      </>
    ),
  };

  // Monday + monthly-workshop Tab 3 — Last Week's Sales. Money cards
  // source from int_calls_enriched (closer-attributed), NOT from the
  // Overview tab's Fanbasis-sourced sectionA. Same denominator basis as
  // the funnel cards below, so Cash/AOV/ACV match the deals breakdown.
  if (showSalesTab && priorWeekFunnel && sectionATab3) {
    panels.t3sales = (
      <Tab3LastWeekSales
        weekLabel={snapshot.weekLabel}
        funnelData={sectionC}
        thisWeek={sectionC}
        priorWeek={priorWeekFunnel}
        sectionATab3={sectionATab3}
        closerOverall={closerOverall}
        setterOverall={setterOverall}
        setterByMode={setterByMode}
        bookingMode={bookingMode}
        devMode={devMode && isAdmin}
        sqlCtx={sqlCtx}
      />
    );
  }
  // Solutions tabs render on BOTH Monday + Thursday per user requirement
  // (preserved across the v2 refactor — see feedback memory).
  panels.t5 = (
    <SolutionsTab
      reportWeek={slug}
      tab="marketing"
      editorEmail={MARKETING_EDITOR}
      initial={mktSolutions}
      currentUserEmail={me?.email ?? ""}
      currentUserIsAdmin={Boolean(me?.isAdmin)}
    />
  );
  panels.t6 = (
    <SolutionsTab
      reportWeek={slug}
      tab="sales"
      editorEmail={SALES_EDITOR}
      initial={salesSolutions}
      currentUserEmail={me?.email ?? ""}
      currentUserIsAdmin={Boolean(me?.isAdmin)}
    />
  );

  return (
    <div className={styles.bg}>
      <TooltipLayer />
      <div className={styles.hdr}>
        <h1>NMM {reportType === "weekly_recap" ? "Monday" : "Thursday"} Report</h1>
        <span className={styles.sub}>
          Latest Webinar: {snapshot.latestWebinar ?? "—"} · KPI window {fmtKpiWindow(kpiStart, kpiEnd)}
        </span>
        <span className={styles.badge}>{snapshot.badge}</span>
        <a
          href="https://www.notion.so/nomoremondays/SOP-Weekly-Report-Monday-recap-Thursday-midweek-check-3629b9a6796a80818391ca056b4b0efc"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 12,
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(59,130,246,.35)",
            background: "rgba(59,130,246,.08)",
            color: "#1d4ed8",
            textDecoration: "none",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
          title="Open the Weekly Report SOP in Notion"
        >
          📖 SOP →
        </a>
        {isAdmin ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
            <DevModeToggle current={devMode} />
            {devMode ? <DownloadAllSqlButton sqlBundle={sqlBundle} filename={sqlFilename} /> : null}
          </span>
        ) : null}
      </div>
      <TopMetrics
        sectionA={sectionA}
        sectionATab3={sectionATab3}
        sectionB={sectionB}
        sectionC={sectionC}
        forecast={forecast}
        kpiStart={kpiStart}
        kpiEnd={kpiEnd}
      />
      <PersistentKpiStrip data={kpiStrip} devMode={devMode && isAdmin} sqlCtx={sqlCtx} />
      <Tabs tabs={tabs} defaultActive="t1" panels={panels} />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function computeWindows(
  weekStart: string,
  weekEnd: string,
  reportType: "weekly_recap" | "midweek_check" | "monthly_workshop_recap",
): { kpiStart: string; kpiEnd: string; latestWebinarDate: string } {
  // For Monday recap: snapshot.weekStart..weekEnd IS the prev Sun-Sat (e.g.,
  // May 3 → May 9 for the May 11 report). latest_sun = weekEnd - 1 (Sun
  // ... wait actually weekEnd is Sat. The latest webinar was the Sunday
  // BEFORE that, e.g., May 10 came after May 3-9. So we'd need run_on - 1.
  // Simpler: take the snapshot's latest_webinar string — but that may be
  // human-formatted. For the KPI window, weekStart and weekEnd ARE the
  // Sun-Sat anchors.
  //
  // For Thursday midweek: snapshot.weekStart is the current Sun, weekEnd
  // is current Wed (Sun..Wed). But spec §1 says the KPI window for Thursday
  // is the PREVIOUS Sun-Sat, NOT the current Sun..Wed. So for a Thursday
  // snapshot we need to shift back.
  if (reportType === "midweek_check") {
    // weekEnd = current Wed. Latest webinar = current Wed.
    // Prev Sun-Sat = (current Wed - 11d) ... (current Wed - 4d)? No, the
    // previous Sun is current Wed - 10d (going back to prior Sun before
    // current week's Sun). Actually: previous Sun-Sat that ends before the
    // current Sun. current Sun = weekStart. So prev Sat = weekStart - 1,
    // prev Sun = weekStart - 7.
    const prevSat = addDays(weekStart, -1);
    const prevSun = addDays(weekStart, -7);
    return { kpiStart: prevSun, kpiEnd: prevSat, latestWebinarDate: weekEnd };
  }
  // Monday recap: weekStart..weekEnd IS the prev Sun-Sat already. Latest
  // webinar (Sun) is the Sunday AFTER weekEnd, i.e., weekEnd + 1.
  return { kpiStart: weekStart, kpiEnd: weekEnd, latestWebinarDate: addDays(weekEnd, 1) };
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Marketing week = Mon-Sun ET (per Taziem confirmation 2026-05-18).
 * Anchored on the latest webinar so the window always WRAPS the focus
 * event of the report instead of ending one day before it.
 *   Sun latest → marketing week = Mon-6d ... Sun (same day)
 *   Wed latest → marketing week = Mon-2d ... Sun+4d (same week containing Wed)
 */
function computeMarketingWindow(latestWebinarDate: string): { mwStart: string; mwEnd: string } {
  const d = new Date(latestWebinarDate + "T00:00:00Z");
  const dow = d.getUTCDay();              // 0=Sun .. 6=Sat
  const daysToNextSun = (7 - dow) % 7;    // 0 if latest is already Sun
  const mwEnd = addDays(latestWebinarDate, daysToNextSun);
  const mwStart = addDays(mwEnd, -6);
  return { mwStart, mwEnd };
}

function fmtKpiWindow(startIso: string, endIso: string): string {
  // "May 3–9, 2026 (Sun–Sat)" — friendly format per spec §3.
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startLabel}–${endLabel} (Sun–Sat)`;
}

async function fetchSectionBData(start: string, end: string, kpiStrip: Awaited<ReturnType<typeof fetchKpiStrip>>) {
  return (await import("@/lib/weekly-report-bq-v2")).fetchSectionB(start, end, kpiStrip);
}
