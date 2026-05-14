// Editorial content for the Thu May 14 midweek-check snapshot
// (week May 10–16, 2026). Numbers come from BQ live; this file only holds
// the hand-written commentary + the Meta campaigns table (still hardcoded
// pending the raw_meta_facebook_ads wiring).
//
// Once we move snapshots into BigQuery, this file gets replaced by
// rows in weekly_report_snapshots + weekly_report_insights.

export const REPORT_META = {
  weekLabel: "Sun May 10 – Wed May 13, 2026 (week-to-date)",
  latestWebinar: "Wed May 13",
  badge: "THU MAY 14, 2026 · MIDWEEK",
};

// ---------- TAB 1: LATEST WEBINAR ----------

export const MAY_10_CONTEXT = {
  tag: "Midweek Context — Week May 10–16",
  title: "Thursday midweek check — Week May 10–16",
  bullets: [] as Array<{
    lead: string;
    body: string;
    code?: string;
    strong?: string;
    bodyAfter?: string;
  }>,
  note:
    "Midweek snapshot — Sun + Wed webinar windows partial. Full recap lands Mon May 18.",
};

// The Meta campaigns table on Tab 1 is still hardcoded — drop empty until
// the raw_meta_facebook_ads wiring lands.
export const META_CAMPAIGNS: Array<{
  name: string;
  spend: string;
  impr: string;
  clicks: string;
  conv: string;
  cpl: string;
  amber?: boolean;
  dn?: boolean;
}> = [];

export const META_CAMPAIGN_TOTAL = {
  label: "All lead-gen",
  spend: "—",
  impr: "—",
  clicks: "—",
  conv: "—",
  cpl: "—",
};

export const MAIN_CAMPAIGN_CPL_TREND: Array<{
  name: string;
  may10: string;
  may3: string;
  apr26: string;
  may10Class?: string;
  apr26Class?: string;
}> = [];

// ---------- TAB 3: STRATEGIC INSIGHTS ----------

export type Insight = {
  tone: "ctx" | "win" | "watch" | "flag" | "fix" | "fwd";
  tag: string;
  title: string;
  body: string;
};

export const INSIGHTS: Insight[] = [];
