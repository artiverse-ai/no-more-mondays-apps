// Dev Mode SQL surfacing — maps every Phase 1 weekly-report metric (KPI
// strip + Tab 1 cards) to the BigQuery template that produced it. The
// templates are imported from weekly-report-bq-v2.ts so the fetcher and
// the dev-mode UI cannot drift.
//
// Two operations exposed:
//   - getResolvedSql(metricKey, ctx) — substitute @start/@end into the
//     template and return a paste-ready query string for one metric.
//   - getAllResolvedSql(ctx) — build a single .sql file with every Phase
//     1 query for the "Download all" button.
//
// Derived metrics (e.g. AOV = cash/deals) attach a `derivation` note so
// the modal can explain that no single query produced the number.

import {
  SQL_AVG_WEBINAR_SHOW_RATE,
  SQL_BLENDED_CASH_ROAS,
  SQL_BOOKING_MODE,
  SQL_CASH_PER_BOOKED_CALL,
  SQL_CLOSER_OVERALL,
  SQL_FUC_CYCLE,
  SQL_META_CAMPAIGNS,
  SQL_OCC_CYCLE,
  SQL_PCT_TIER_ONE_LEADS,
  SQL_SECTION_A_CASH,
  SQL_SECTION_A_HL,
  SQL_SECTION_B,
  SQL_SECTION_C,
  SQL_SETTER_BY_MODE,
  SQL_SETTER_OVERALL,
  SQL_WEBINAR_COMPARISON,
} from "./weekly-report-bq-v2";

export type SqlCtx = {
  kpiStart: string;             // sales week Sun-Sat ET — closer/funnel/cash metrics
  kpiEnd: string;
  latestWebinarDate: string;    // anchors Avg Webinar Show Rate last-3 lookback
  mwStart: string;              // marketing week Mon-Sun ET — webinar/ad-spend metrics
  mwEnd: string;
  // Tab 2 extras (Latest Webinar). Optional so Phase 1 callers can omit.
  comparisonDates?: string[];   // 3 dates in YYYY-MM-DD order (latest first)
  promoStart?: string;          // Meta campaign promo window start
  promoEnd?: string;
  // Tab 3 extras (Last Week's Sales, Monday only).
  priorWeekStart?: string;
  priorWeekEnd?: string;
};

export type SqlBlock = { label: string; sql: string };

// Param value: either a plain string (will be inlined as a quoted BQ literal)
// or `{ raw: string }` for values that already form a BQ expression — e.g.
// an ARRAY literal like ['2026-05-10','2026-05-06'].
export type SqlParamValue = string | { raw: string };

export type MetricSqlEntry = {
  blocks: SqlBlock[];                  // one or more SQL queries
  derivation?: string;                  // for derived metrics (e.g. "Cash / Deals")
  params: (ctx: SqlCtx) => Record<string, SqlParamValue>;
};

export type MetricKey =
  // KPI strip
  | "avgWebinarShowRate"
  | "pctTierOneLeads"
  | "blendedCashRoas"
  | "cplBlended"
  | "cashPerBookedCall"
  // Section A — money
  | "cashCollected"
  | "revenueTcv"
  | "roasCash"
  | "roasTcv"
  | "adSpendBlended"
  | "dealsClosed"
  | "aov"
  | "acv"
  | "pifRate"
  | "cashCollectionRate"
  // Section A — cycle
  | "medianBookToCloseOcc"
  | "avgBookToCloseOcc"
  | "medianFirstCallToCloseFuc"
  | "avgFirstCallToCloseFuc"
  // Section B
  | "totalCallsBooked"
  | "costPerBookedCall"
  // Section C — funnel counts
  | "funnelProspects"
  | "funnelProspectsSq"
  | "funnelShows"
  | "funnelQualifiedShows"
  | "funnelDeals"
  // Section C — rates
  | "showRate"
  | "closeRateShows"
  | "closeRateCq"
  | "setterDqRate"
  | "closerDqRate"
  // Section C — efficiency
  | "ddToCq"
  | "ddToClose"
  | "dollarsCcPerPdd"
  | "dollarsCcPerShowsSq"
  | "dollarsTcvPerPdd"
  | "dollarsTcvPerShowsSq"
  // Tab 2 — Latest Webinar comparison (one SQL drives the entire table)
  | "webinarComparison"
  // Tab 2 — Meta campaigns table
  | "metaCampaigns"
  // Tab 3 — Last Week's Sales tables
  | "closerOverall"
  | "setterOverall"
  | "setterByMode"
  | "bookingMode"
  // Tab 3 — prior-week funnel (for WoW comparison)
  | "priorWeekFunnel";

const kpiParams = (ctx: SqlCtx) => ({ start: ctx.kpiStart, end: ctx.kpiEnd });
const latestWebinarParams = (ctx: SqlCtx) => ({ latest: ctx.latestWebinarDate });
const mwParams = (ctx: SqlCtx) => ({ start: ctx.mwStart, end: ctx.mwEnd });

// ============================================================================
// Helpers exported below: METRIC_SQL, resolveSql, getResolvedSql,
// getAllResolvedSql, getMetricLabel, bigqueryConsoleUrl.
// ============================================================================

const SECTION_A_BLOCKS: SqlBlock[] = [
  { label: "Fanbasis cash (sale_date window)", sql: SQL_SECTION_A_CASH },
  { label: "HL daily aggregates (TCV, ad spend, deals, PIF)", sql: SQL_SECTION_A_HL },
];

export const METRIC_SQL: Record<MetricKey, MetricSqlEntry> = {
  // KPI strip ---------------------------------------------------------------
  avgWebinarShowRate: {
    blocks: [{ label: "Avg Webinar Show Rate (last 3 webinars anchored on latest_webinar_date)", sql: SQL_AVG_WEBINAR_SHOW_RATE }],
    params: latestWebinarParams,
  },
  pctTierOneLeads: {
    blocks: [{ label: "% Tier 1 Leads (placeholder — fields not yet in mart) · marketing week", sql: SQL_PCT_TIER_ONE_LEADS }],
    derivation: "Returns null today — tier_one_submissions + form_submissions not yet ingested into mart_webinar_events. Window: marketing week Mon-Sun.",
    params: mwParams,
  },
  blendedCashRoas: {
    blocks: [{ label: "Blended Cash ROAS", sql: SQL_BLENDED_CASH_ROAS }],
    params: kpiParams,
  },
  cplBlended: {
    blocks: [],
    derivation: "Open Item #2 — blended denominator not yet decided. Renders N/A until then.",
    params: kpiParams,
  },
  cashPerBookedCall: {
    blocks: [{ label: "Cash / Booked Call (DPC)", sql: SQL_CASH_PER_BOOKED_CALL }],
    params: kpiParams,
  },

  // Section A — money -------------------------------------------------------
  cashCollected: { blocks: [SECTION_A_BLOCKS[0]], params: kpiParams },
  revenueTcv: { blocks: [SECTION_A_BLOCKS[1]], derivation: "SUM(total_revenue_contracted)", params: kpiParams },
  roasCash: {
    blocks: SECTION_A_BLOCKS,
    derivation: "Cash (Fanbasis) / Ad Spend (HL daily). Combined client-side.",
    params: kpiParams,
  },
  roasTcv: {
    blocks: [SECTION_A_BLOCKS[1]],
    derivation: "TCV / Ad Spend. Both columns from the HL daily aggregate.",
    params: kpiParams,
  },
  adSpendBlended: { blocks: [SECTION_A_BLOCKS[1]], derivation: "SUM(total_ad_spend)", params: kpiParams },
  dealsClosed: { blocks: [SECTION_A_BLOCKS[1]], derivation: "SUM(total_deals_closed)", params: kpiParams },
  aov: {
    blocks: SECTION_A_BLOCKS,
    derivation: "Fanbasis cash / SUM(total_deals_closed). Combined client-side.",
    params: kpiParams,
  },
  acv: {
    blocks: [SECTION_A_BLOCKS[1]],
    derivation: "TCV / SUM(total_deals_closed). Both columns from the HL daily aggregate.",
    params: kpiParams,
  },
  pifRate: {
    blocks: [SECTION_A_BLOCKS[1]],
    derivation: "SUM(count_pif_deals) / SUM(total_deals_closed).",
    params: kpiParams,
  },
  cashCollectionRate: {
    blocks: SECTION_A_BLOCKS,
    derivation: "Fanbasis cash / TCV. Combined client-side.",
    params: kpiParams,
  },

  // Section A — cycle -------------------------------------------------------
  medianBookToCloseOcc: { blocks: [{ label: "OCC cycle", sql: SQL_OCC_CYCLE }], params: kpiParams },
  avgBookToCloseOcc: { blocks: [{ label: "OCC cycle", sql: SQL_OCC_CYCLE }], params: kpiParams },
  medianFirstCallToCloseFuc: { blocks: [{ label: "FUC cycle", sql: SQL_FUC_CYCLE }], params: kpiParams },
  avgFirstCallToCloseFuc: { blocks: [{ label: "FUC cycle", sql: SQL_FUC_CYCLE }], params: kpiParams },

  // Section B ---------------------------------------------------------------
  totalCallsBooked: { blocks: [{ label: "Section B aggregates", sql: SQL_SECTION_B }], params: kpiParams },
  costPerBookedCall: {
    blocks: [{ label: "Section B aggregates", sql: SQL_SECTION_B }],
    derivation: "SUM(total_ad_spend) / SUM(total_calls_booked).",
    params: kpiParams,
  },

  // Section C — counts ------------------------------------------------------
  funnelProspects: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], params: kpiParams },
  funnelProspectsSq: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], params: kpiParams },
  funnelShows: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], params: kpiParams },
  funnelQualifiedShows: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], params: kpiParams },
  funnelDeals: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], params: kpiParams },

  // Section C — rates -------------------------------------------------------
  showRate: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "shows_sq / prospects_sq", params: kpiParams },
  closeRateShows: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "deals / shows_sq", params: kpiParams },
  closeRateCq: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "deals / shows_cq", params: kpiParams },
  setterDqRate: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "setter_dq / prospects_dd", params: kpiParams },
  closerDqRate: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "closer_dq / shows_sq", params: kpiParams },

  // Section C — efficiency --------------------------------------------------
  ddToCq: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "shows_cq / prospects_dd", params: kpiParams },
  ddToClose: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "deals / prospects_dd", params: kpiParams },
  dollarsCcPerPdd: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "cash_int_calls / prospects_dd", params: kpiParams },
  dollarsCcPerShowsSq: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "cash_int_calls / shows_sq", params: kpiParams },
  dollarsTcvPerPdd: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "revenue / prospects_dd", params: kpiParams },
  dollarsTcvPerShowsSq: { blocks: [{ label: "Section C funnel", sql: SQL_SECTION_C }], derivation: "revenue / shows_sq", params: kpiParams },

  // Tab 2 — Latest Webinar comparison ---------------------------------------
  webinarComparison: {
    blocks: [{ label: "3-Webinar comparison (mart_webinar_events)", sql: SQL_WEBINAR_COMPARISON }],
    derivation: "One row per webinar in @dates. Every column on the Latest Webinar tab comes from this query.",
    params: (ctx) => ({ dates: { raw: arrayLiteral(ctx.comparisonDates ?? []) } }),
  },
  metaCampaigns: {
    blocks: [{ label: "Meta campaigns (Tab 2)", sql: SQL_META_CAMPAIGNS }],
    derivation: "Promo-window aggregates per campaign — only webinar_registration + webinar_hammer_them categories.",
    params: (ctx) => ({ start: ctx.promoStart ?? ctx.kpiStart, end: ctx.promoEnd ?? ctx.kpiEnd }),
  },

  // Tab 3 — Last Week's Sales tables ----------------------------------------
  closerOverall: {
    blocks: [{ label: "Closer Performance — Overall (Monday §9.5)", sql: SQL_CLOSER_OVERALL }],
    params: kpiParams,
  },
  setterOverall: {
    blocks: [{ label: "Setter Performance — Overall (Monday §9.6)", sql: SQL_SETTER_OVERALL }],
    params: kpiParams,
  },
  setterByMode: {
    blocks: [{ label: "Setter Performance — by Booking Mode (Monday §9.7)", sql: SQL_SETTER_BY_MODE }],
    derivation: "Joins int_calls_enriched to stg_ghl_form_submissions_flat for time-to-book median.",
    params: kpiParams,
  },
  bookingMode: {
    blocks: [{ label: "Booking Mode Split (Monday §9.8)", sql: SQL_BOOKING_MODE }],
    params: kpiParams,
  },
  priorWeekFunnel: {
    blocks: [{ label: "Section C funnel — PRIOR Sun-Sat (for WoW)", sql: SQL_SECTION_C }],
    derivation: "Re-runs the Section C funnel query on the prior Sun-Sat for WoW comparison.",
    params: (ctx) => ({ start: ctx.priorWeekStart ?? ctx.kpiStart, end: ctx.priorWeekEnd ?? ctx.kpiEnd }),
  },
};

// Format a JS string[] as a BQ ARRAY literal: ['2026-05-10','2026-05-06',...].
function arrayLiteral(arr: string[]): string {
  return `[${arr.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")}]`;
}

// Human-readable label for the modal title.
const METRIC_LABEL: Record<MetricKey, string> = {
  avgWebinarShowRate: "Avg Webinar Show Rate",
  pctTierOneLeads: "% Tier 1 Leads",
  blendedCashRoas: "Blended Cash ROAS",
  cplBlended: "CPL Blended",
  cashPerBookedCall: "Cash / Booked Call (DPC)",
  cashCollected: "Cash Collected",
  revenueTcv: "Revenue (TCV)",
  roasCash: "ROAS (Cash)",
  roasTcv: "ROAS (TCV)",
  adSpendBlended: "Ad Spend (Blended)",
  dealsClosed: "Deals Closed",
  aov: "AOV",
  acv: "ACV",
  pifRate: "PIF Rate",
  cashCollectionRate: "Cash Collection Rate",
  medianBookToCloseOcc: "OCC Median (Book → Close)",
  avgBookToCloseOcc: "OCC Average (Book → Close)",
  medianFirstCallToCloseFuc: "FUC Median (1st Call → Close)",
  avgFirstCallToCloseFuc: "FUC Average (1st Call → Close)",
  totalCallsBooked: "Total Calls Booked",
  costPerBookedCall: "Cost / Booked Call",
  funnelProspects: "Prospects",
  funnelProspectsSq: "Prospects (SQ)",
  funnelShows: "Shows",
  funnelQualifiedShows: "Qualified Shows",
  funnelDeals: "Deals",
  showRate: "Show Rate",
  closeRateShows: "Close Rate (Shows)",
  closeRateCq: "Close Rate (CQ)",
  setterDqRate: "Setter DQ Rate",
  closerDqRate: "Closer DQ Rate",
  ddToCq: "Prospect to Qualified Show Efficiency",
  ddToClose: "Prospect to Close Efficiency",
  dollarsCcPerPdd: "$ (CC) / Pros (D'd)",
  dollarsCcPerShowsSq: "$ (CC) / Shows (SQ)",
  dollarsTcvPerPdd: "$ (TCV) / Pros (D'd)",
  dollarsTcvPerShowsSq: "$ (TCV) / Shows (SQ)",
  webinarComparison: "Latest Webinar — 3-Webinar Comparison",
  metaCampaigns: "Meta Campaigns (Tab 2)",
  closerOverall: "Closer Performance — Overall",
  setterOverall: "Setter Performance — Overall",
  setterByMode: "Setter Performance — by Booking Mode",
  bookingMode: "Booking Mode Split",
  priorWeekFunnel: "Section C funnel — PRIOR week (WoW)",
};

export function getMetricLabel(k: MetricKey): string {
  return METRIC_LABEL[k];
}

// Replace @param placeholders with BQ literals. DATE wrappers in the
// template (e.g. `DATE(@start)`) survive intact — only the @param slot
// gets substituted. Plain strings become quoted BQ literals; `{ raw }`
// values are inlined verbatim (used for ARRAY[...] etc.).
export function resolveSql(template: string, params: Record<string, SqlParamValue>): string {
  return template.replace(/@(\w+)/g, (whole, name) => {
    const v = params[name];
    if (v == null) return whole;
    if (typeof v === "object" && "raw" in v) return v.raw;
    return `'${v.replace(/'/g, "''")}'`;
  });
}

export type ResolvedMetricSql = {
  metricKey: MetricKey;
  label: string;
  blocks: { label: string; sql: string }[];
  derivation?: string;
};

export function getResolvedSql(metricKey: MetricKey, ctx: SqlCtx): ResolvedMetricSql {
  const entry = METRIC_SQL[metricKey];
  const params = entry.params(ctx);
  return {
    metricKey,
    label: getMetricLabel(metricKey),
    blocks: entry.blocks.map((b) => ({ label: b.label, sql: resolveSql(b.sql, params) })),
    derivation: entry.derivation,
  };
}

// Build the .sql file dumped by the "Download all" button. One section
// per metric, with the resolved SQL inline. Headers as -- comments so
// the file is valid SQL that can be opened in BigQuery directly.
export function getAllResolvedSql(ctx: SqlCtx): string {
  const lines: string[] = [];
  lines.push(`-- ============================================================================`);
  lines.push(`-- NMM Weekly Report — Resolved SQL dump (Phase 1: KPI strip + Tab 1)`);
  lines.push(`-- Window: ${ctx.kpiStart} → ${ctx.kpiEnd}`);
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- ============================================================================`);
  lines.push("");

  // Walk through METRIC_SQL in declared order.
  const seenSqls = new Set<string>();
  for (const key of Object.keys(METRIC_SQL) as MetricKey[]) {
    const resolved = getResolvedSql(key, ctx);
    lines.push(`-- ----------------------------------------------------------------------------`);
    lines.push(`-- ${resolved.label}` + (resolved.derivation ? `   (derivation: ${resolved.derivation})` : ""));
    lines.push(`-- ----------------------------------------------------------------------------`);
    if (resolved.blocks.length === 0) {
      lines.push("-- (no SQL — placeholder metric)");
      lines.push("");
      continue;
    }
    for (const b of resolved.blocks) {
      // De-dupe identical SQL bodies — many metrics share the Section A/B/C
      // query. Print the SQL once with the first metric, reference it after.
      if (seenSqls.has(b.sql)) {
        lines.push(`-- (uses query: ${b.label} — already shown above)`);
      } else {
        lines.push(`-- ${b.label}`);
        lines.push(b.sql + ";");
        seenSqls.add(b.sql);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// (BigQuery-console deep-link is built in the client component since it
//  needs btoa — see components/SqlInfoButton.tsx.)
