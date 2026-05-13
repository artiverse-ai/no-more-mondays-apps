// All numbers hard-coded from the original HTML report
// (Mon May 11, 2026 — week of May 3-9). Once we wire BQ-driven dynamic
// generation this file gets replaced by SQL queries against
// `mart_webinar_events` and `int_calls_enriched`.

export const REPORT_META = {
  weekLabel: "Week May 3–9, 2026",
  latestWebinar: "Sun May 10",
  badge: "MON MAY 11, 2026",
};

// ---------- TAB 1: LATEST WEBINAR ----------

export const MAY_10_CONTEXT = {
  tag: "Marketing Context — Sun May 10 Mini Lump Sum Event",
  title: 'Sun May 10 — "Mini Lump Sum" Make-Up Event (Mother\'s Day)',
  bullets: [
    {
      lead: "Expanded reactivation (3,705 contacts):",
      body: "Multi-cycle no-show pool from webinars starting Apr 22. GHL tag confirmed: ",
      code: "event: no show-webinar-2026-05-06-mini-lump-sum-reactivation",
      bodyAfter: ". Mart now picking up correctly.",
    },
    {
      lead: "Zoom enrollment process change (first time):",
      body: "Reactivated contacts enrolled as Zoom registrants — received 1-day + 1-hour reminders. Total Zoom enrollment: ",
      strong: "4,160",
      bodyAfter: " (960 standard GHL regs + ~3,200 reactivated). Attend rate and cost/attendee not comparable to prior cycles.",
    },
    {
      lead: "Ad spend approximated at 12pm ET cutoff:",
      body: "Meta data is daily-grain only. Adjusted attributed spend: ",
      strong: "~$5,906",
      bodyAfter: " vs mart figure $6,930. All May 10 CEO metrics use adjusted spend.",
    },
    {
      lead: "Mother's Day (May 10):",
      body: "External factor likely suppressing same-day booking behaviour. Monitoring booking tail through Wednesday.",
    },
  ],
  note:
    "Sales as of report pull: 42 calls booked, 32 active, 7 held, 1 deal ($4,997 cash). Partial — cycle evaluation at Thursday midweek report.",
};

export type ComparisonRow =
  | {
      kind: "data";
      label: string;
      tip?: string;
      values: [string, string, string]; // [May10, May6, May3]
      classes?: ["lh" | "lh up" | "lh dn" | "lh tag-p" | "lh tag-g", "" | "up" | "dn" | "nt", "" | "up" | "dn" | "nt"];
    }
  | { kind: "divider"; label: string };

export const TOP_OF_FUNNEL: ComparisonRow[] = [
  { kind: "divider", label: "Registration" },
  {
    kind: "data",
    label: "Ad Spend (adj.)",
    tip: "Ad spend attributed to this webinar promo window.\nMay 10: adjusted ~$5,906 (50% Sun $1,024 + full Thu+Fri+Sat $4,882).\nMart figure: $6,930.\nSource: mart_webinar_events.ad_spend",
    values: ["~$5,906 *", "$5,048", "$5,804"],
  },
  {
    kind: "data",
    label: "LP Page Views",
    tip: "Landing page views.\nSource: mart_webinar_events.lp_page_views",
    values: ["3,787", "3,495", "5,123"],
  },
  {
    kind: "data",
    label: "LP Opt-in Rate",
    tip: "lp_opt_ins / lp_page_views.\nSource: mart_webinar_events.lp_opt_in_rate",
    values: ["20.8%", "20.5%", "17.9%"],
  },
  {
    kind: "data",
    label: "Total Registrants (GHL)",
    tip: "GHL-tagged registrants — primary source of truth.\nSource: mart_webinar_events.total_registrants",
    values: ["960", "818", "952"],
  },
  {
    kind: "data",
    label: "↳ Meta (paid)",
    tip: "traffic_source = 'meta'.\nSource: mart_webinar_events.meta_registrants",
    values: ["861", "639", "793"],
  },
  {
    kind: "data",
    label: "↳ ManyChat",
    tip: "Contacts tagged 'webinar registration - [manychat ig dm]'.\nSource: mart_webinar_events.manychat_registrants",
    values: ["33", "99", "26"],
  },
  {
    kind: "data",
    label: "↳ Setter",
    tip: "ref_param IN ('swp','hna','sal').\nSource: mart_webinar_events.setter_registrants",
    values: ["0", "13", "24"],
    classes: ["lh dn", "", ""],
  },
  {
    kind: "data",
    label: "↳ Other Organic †",
    tip: "LP form subs not attributable to meta/tiktok/setter/manychat.\nIncludes Skool Community posts (new channel).\nSource: mart_webinar_events.other_organic_registrants",
    values: ["68", "74", "118"],
  },
  { kind: "divider", label: "Attendance" },
  {
    kind: "data",
    label: "Unique Attendees ‡",
    tip: "Unique Zoom attendees (best session).\nMay 10 total Zoom enrollment: 4,160 (960 standard + ~3,200 reactivated).\nGHL attend rate: 183/960 = 19.1%.\nZoom enrollment attend rate: 183/4,160 = 4.4% — not comparable.\nSource: mart_webinar_events.unique_attendees",
    values: ["183", "92", "160"],
  },
  {
    kind: "data",
    label: "Pitched (>25 min)",
    tip: "Attendees >25 min cumulative.\nSource: mart_webinar_events.pitched_attendees",
    values: ["110", "56", "112"],
  },
  {
    kind: "data",
    label: "Attend Rate (GHL basis) ‡",
    tip: "unique_attendees / total_registrants (GHL basis).\nMay 10 GHL basis: 183/960 = 19.1%.\nSource: mart_webinar_events.reg_to_attend_rate",
    values: ["19.1%", "12.7%", "17.1%"],
  },
  {
    kind: "data",
    label: "Pitch Rate",
    tip: "pitched_attendees / unique_attendees.\nSource: mart_webinar_events.attend_to_pitched_rate",
    values: ["60.1%", "60.9%", "70.0%"],
  },
  { kind: "divider", label: "CEO Cost Efficiency — May 10 uses ~$5,906 adjusted spend" },
  {
    kind: "data",
    label: "Cost / Reg (Paid) *",
    tip: "ad_spend / meta_registrants.\nMay 10 adjusted: ~$5,906/861 = $6.86.\nSource: mart_webinar_events.paid_cpr",
    values: ["$6.86", "$7.90", "$7.32"],
  },
  {
    kind: "data",
    label: "Cost / Reg (Blended) *",
    tip: "ad_spend / total_registrants.\nMay 10 adjusted: ~$5,906/960 = $6.15.\nSource: mart_webinar_events.blended_cpr",
    values: ["$6.15", "$6.95", "$6.21"],
  },
  {
    kind: "data",
    label: "Cost / Attendee ‡ *",
    tip: "ad_spend / unique_attendees (GHL attend basis).\nMay 10 adjusted: ~$5,906/183 = $32.27.\nZoom enrollment basis: $5,906/4,160 = $1.42 — not meaningful.\nSource: mart_webinar_events.blended_cpa",
    values: ["$32.27", "$54.87", "$36.28"],
  },
  { kind: "divider", label: "Sales — Webinar-Attributed (partial as of report pull)" },
  {
    kind: "data",
    label: "Calls Booked",
    tip: "Total Calendly bookings.\nMart: 42 total (most current).\nSource: mart_webinar_events.calls_booked",
    values: ["42", "18", "35"],
    classes: ["lh tag-g", "", ""],
  },
  {
    kind: "data",
    label: "Calls on Calendar",
    tip: "Non-canceled bookings (dynamic).\nSource: mart_webinar_events.calls_booked_active",
    values: ["32", "12", "23"],
    classes: ["lh tag-g", "", ""],
  },
  {
    kind: "data",
    label: "Cost / Booked Call *",
    tip: "ad_spend / calls_booked.\nMay 10 adjusted: ~$5,906/42 = $140.61.\nSource: mart_webinar_events.blended_cpbc",
    values: ["$140.61", "$280.47", "$165.83"],
  },
  {
    kind: "data",
    label: "Calls Held",
    tip: "Calls actually held.\n7 as of report pull — partial.\nSource: mart_webinar_events.calls_held",
    values: ["7 (partial)", "13", "19"],
    classes: ["lh tag-p", "", ""],
  },
  {
    kind: "data",
    label: "Deals",
    tip: "COUNT DISTINCT is_deal.\nSource: mart_webinar_events.deals_closed",
    values: ["1 (partial)", "3", "4"],
    classes: ["lh tag-p", "", ""],
  },
  {
    kind: "data",
    label: "Cash",
    tip: "SUM cash_collected WHERE is_deal.\nSource: mart_webinar_events.cash_collected",
    values: ["$4,997 (partial)", "$10,991", "$3,000"],
    classes: ["lh tag-p", "", ""],
  },
  {
    kind: "data",
    label: "ROAS (Cash) *‡",
    tip: "cash_collected / ad_spend.\nMay 10: $4,997/~$5,906 = 0.85x — 1 deal, not meaningful yet.\nSource: mart_webinar_events.roas_cash",
    values: ["0.85× partial", "2.18×", "0.52×"],
    classes: ["lh tag-p", "up", "dn"],
  },
  {
    kind: "data",
    label: "ROAS (Revenue) *‡",
    tip: "revenue_generated / ad_spend.\nMay 10: partial.\nSource: mart_webinar_events.roas_revenue",
    values: ["0.85× partial", "2.57×", "2.41×"],
    classes: ["lh tag-p", "up", "up"],
  },
  {
    kind: "data",
    label: "CAC *‡",
    tip: "ad_spend / deals_closed.\nMay 10: not meaningful at 1 deal.\nSource: mart_webinar_events.cac",
    values: ["$5,906 partial", "$1,682.79", "$1,451.02"],
    classes: ["lh tag-p", "", ""],
  },
];

export const CHANNEL_MIX_MAY10 = [
  { name: "Meta (paid)", count: 861, pct: 89.7, color: "blue" },
  { name: "Other organic", count: 68, pct: 7.1, color: "green" },
  { name: "ManyChat", count: 33, pct: 3.4, color: "amber" },
  { name: "Setter", count: 0, pct: 0.0, color: "purple" },
] as const;

export const CHANNEL_MIX_TREND = [
  { name: "Meta paid", may10: "89.7%", may6: "78.1%", may3: "83.3%" },
  { name: "ManyChat", may10: "3.4%", may6: "12.1%", may3: "2.7%" },
  { name: "Setter", may10: "0.0%", may6: "1.6%", may3: "2.5%", dn: true },
  { name: "Other organic", may10: "7.1%", may6: "9.0%", may3: "12.4%" },
];

export const META_CAMPAIGNS = [
  { name: "[NMM] Webinar/Workshop Campaign", spend: "$7,475.61", impr: "151,499", clicks: "3,843", conv: "362", cpl: "$20.65" },
  { name: "[NMM] Broad | Webinar T1 Leads", spend: "$2,303.53", impr: "31,996", clicks: "2,010", conv: "88", cpl: "$26.18" },
  { name: "[NMM] Hammer Them 1 – Webinar Leads", spend: "$774.97", impr: "30,198", clicks: "65", conv: "0", cpl: "—", amber: true, dn: true },
];

export const META_CAMPAIGN_TOTAL = {
  label: "All lead-gen",
  spend: "$10,554",
  impr: "213,693",
  clicks: "5,918",
  conv: "450",
  cpl: "$23.45",
};

export const MAIN_CAMPAIGN_CPL_TREND = [
  { name: "Webinar/Workshop Campaign", may10: "$20.65", may3: "$25.83", apr26: "$69.37", may10Class: "up", apr26Class: "dn" },
  { name: "Broad T1 Leads", may10: "$26.18", may3: "$36.29", apr26: "$42.73", may10Class: "up" },
  { name: "Hammer Them 1", may10: "0 conv", may3: "0 conv", apr26: "0 conv", may10Class: "nt" },
];

export const REACTIVATION_FUNNEL = [
  { webinar: "May 10 Sun (Mini Lump Sum) †", pool: "3,705", attended: "86", attendRate: "2.3%", booked: "17", bookRate: "19.8%", highlight: true, upAttended: true, upBooked: true },
  { webinar: "May 6 Wed", pool: "553", attended: "10", attendRate: "1.8%", booked: "0", bookRate: "0.0%" },
  { webinar: "May 3 Sun", pool: "689", attended: "12", attendRate: "1.7%", booked: "5", bookRate: "41.7%" },
];

// ---------- TAB 2: SALES ----------

export const FUNNEL_STAGES = [
  { label: "Prospects", value: 84, width: 100, color: "blue", tip: "COUNT DISTINCT prospect_email_lc\nDate filter: DATE(appointment_date_time) BETWEEN '2026-05-03' AND '2026-05-09'\nSource: int_calls_enriched" },
  { label: "Prospects (SQ)", value: 57, width: 67.9, color: "blue", tip: "Prospects (SQ) — Setter-Qualified\nCOUNT DISTINCT WHERE is_show_rate_eligible\n= dispositioned AND NOT rescheduled AND call_outcome ≠ 'Setter DQ'" },
  { label: "Shows (SQ)", value: 39, width: 46.4, color: "green", tip: "Shows (SQ) — Setter-Qualified Show-Ups\nCOUNT DISTINCT WHERE is_show_up\n= is_held AND call_outcome ≠ 'Setter DQ'" },
  { label: "Shows (CQ)", value: 34, width: 40.5, color: "amber", tip: "Shows (CQ) — Closer-Qualified Show-Ups\nCOUNT DISTINCT WHERE is_close_rate_eligible\n= is_held AND call_outcome NOT IN ('Setter DQ','Closer DQ')" },
  { label: "Deals", value: 13, width: 15.5, color: "purple", tip: "COUNT DISTINCT WHERE is_deal\nDate filter: DATE(appointment_date_time) BETWEEN '2026-05-03' AND '2026-05-09'\nSource: int_calls_enriched" },
];

export const FUNNEL_CONNECTORS = [
  { rate: "57 Prospects (SQ)", drop: "−27 (Setter DQ: 14 · Rescheduled/other: 13)" },
  { rate: "Show Rate 68.4% ▴", drop: "−18 no-shows / cancels", rateColor: "green" },
  { rate: "34 Shows (CQ)", drop: "−5 Closer DQ" },
  { rate: "Close Rate 38.2%", drop: "−21 lost / follow-up", rateColor: "green" },
];

export const KPI_CARDS = [
  { label: "Cash Collected", value: "$41,772", change: "↓ −36.2% vs $65,416 prior wk", changeClass: "dn", tip: "SUM cash_collected WHERE is_deal\nappointment_date_time basis\nSource: int_calls_enriched" },
  { label: "Revenue (TCV)", value: "$54,961", change: "↓ −27.6% vs $75,943 prior wk", changeClass: "dn", tip: "SUM revenue_generated WHERE is_deal\nSource: int_calls_enriched" },
  { label: "AOV", value: "$3,213", change: "↓ −6.7% vs $3,443 prior wk", changeClass: "dn", tip: "Cash / Deals · $41,772 / 13" },
  { label: "ACV", value: "$4,228", change: "↑ +5.8% vs $3,997 prior wk", changeClass: "up", tip: "Revenue / Deals · $54,961 / 13" },
  { label: "Cash Collection Rate", value: "76.0%", change: "↓ vs 86.1% prior wk", changeClass: "dn", tip: "Cash / Revenue · $41,772 / $54,961" },
  { label: "Setter DQ Rate", value: "18.4%", change: "↓ improved vs 24.2% ✓", changeClass: "up", tip: "Setter DQ / Prospects (D'd)\n= 14 / 76\nLooker §9.4 formula\nSource: int_calls_enriched" },
];

export type WoWRow =
  | { kind: "data"; label: string; tip?: string; thisWeek: string; prior: string; change: string; changeClass?: "up" | "dn" | "nt"; thisWeekClass?: "lh" | "lh up" | "lh dn" }
  | { kind: "divider"; label: string };

export const WOW_COMPARISON: WoWRow[] = [
  { kind: "divider", label: "Funnel Volume" },
  { kind: "data", label: "Prospects", thisWeek: "84", prior: "122", change: "↓ −31.1%", changeClass: "dn" },
  { kind: "data", label: "Prospects (D'd)", thisWeek: "76", prior: "120", change: "↓ −36.7%", changeClass: "dn" },
  { kind: "data", label: "Setter DQ", thisWeek: "14", prior: "29", change: "↓ −51.7% ✓", changeClass: "up", thisWeekClass: "lh up" },
  { kind: "data", label: "Closer DQ", thisWeek: "5", prior: "4", change: "↑ +1", changeClass: "nt" },
  { kind: "data", label: "Prospects (SQ)", thisWeek: "57", prior: "87", change: "↓ −34.5%", changeClass: "dn" },
  { kind: "data", label: "Shows (SQ)", thisWeek: "39", prior: "51", change: "↓ −23.5%", changeClass: "dn" },
  { kind: "data", label: "Shows (CQ)", thisWeek: "34", prior: "47", change: "↓ −27.7%", changeClass: "dn" },
  { kind: "data", label: "Deals", thisWeek: "13", prior: "19", change: "↓ −31.6%", changeClass: "dn" },
  { kind: "divider", label: "Rates" },
  { kind: "data", label: "Show Rate", tip: "Shows (SQ) / Prospects (SQ) · 39/57 this wk · 51/87 prior", thisWeek: "68.4%", prior: "58.6%", change: "↑ +9.8pp ✓", changeClass: "up", thisWeekClass: "lh up" },
  { kind: "data", label: "Close Rate", tip: "Deals / Shows (CQ) · 13/34 this wk · 19/47 prior", thisWeek: "38.2%", prior: "40.4%", change: "↓ −2.2pp", changeClass: "nt" },
  { kind: "divider", label: "Revenue" },
  { kind: "data", label: "Cash", thisWeek: "$41,772", prior: "$65,416", change: "↓ −36.2%", changeClass: "dn" },
  { kind: "data", label: "Revenue (TCV)", thisWeek: "$54,961", prior: "$75,943", change: "↓ −27.6%", changeClass: "dn" },
  { kind: "data", label: "AOV", thisWeek: "$3,213", prior: "$3,443", change: "↓ −6.7%", changeClass: "dn" },
  { kind: "data", label: "ACV", thisWeek: "$4,228", prior: "$3,997", change: "↑ +5.8%", changeClass: "up" },
  { kind: "data", label: "Cash Collection Rate", thisWeek: "76.0%", prior: "86.1%", change: "↓ −10.1pp", changeClass: "dn" },
];

export type PerWebinarRow = {
  closer: string;
  prospects: string;
  prosSQ: string;
  showsSQ: string;
  showsCQ: string;
  deals: string;
  close: string;
  upDeals?: boolean;
  upClose?: boolean;
  dnDeals?: boolean;
  dnClose?: boolean;
  ntClose?: boolean;
};

export const PER_WEBINAR_MAY3: PerWebinarRow[] = [
  { closer: "Johanna", prospects: "3", prosSQ: "3", showsSQ: "1", showsCQ: "1", deals: "1", close: "100%", upDeals: true, upClose: true },
  { closer: "Ben", prospects: "5", prosSQ: "4", showsSQ: "3", showsCQ: "3", deals: "1", close: "33.3%" },
  { closer: "Destiny", prospects: "7", prosSQ: "5", showsSQ: "2", showsCQ: "2", deals: "1", close: "50.0%" },
  { closer: "Cecilia", prospects: "7", prosSQ: "5", showsSQ: "3", showsCQ: "3", deals: "0", close: "0.0%", dnDeals: true, dnClose: true },
  { closer: "Tyler", prospects: "7", prosSQ: "4", showsSQ: "3", showsCQ: "1", deals: "0", close: "0.0%", dnDeals: true, dnClose: true },
  { closer: "Morgan", prospects: "2", prosSQ: "2", showsSQ: "1", showsCQ: "0", deals: "0", close: "—", ntClose: true },
];

export const PER_WEBINAR_MAY6: PerWebinarRow[] = [
  { closer: "Destiny", prospects: "3", prosSQ: "3", showsSQ: "3", showsCQ: "2", deals: "1", close: "50.0%" },
  { closer: "Ben", prospects: "2", prosSQ: "1", showsSQ: "1", showsCQ: "1", deals: "1", close: "100%", upDeals: true, upClose: true },
  { closer: "Johanna", prospects: "4", prosSQ: "1", showsSQ: "0", showsCQ: "0", deals: "0", close: "—", ntClose: true },
  { closer: "Morgan", prospects: "7", prosSQ: "1", showsSQ: "1", showsCQ: "1", deals: "0", close: "0.0%", dnClose: true },
  { closer: "Cecilia", prospects: "1", prosSQ: "0", showsSQ: "0", showsCQ: "0", deals: "0", close: "—", ntClose: true },
];

export const CLOSER_OVERALL = [
  { closer: "Tyler", prospects: "15", prosD: "12", sDQ: "2", cDQ: "2", prosSQ: "9", showsSQ: "7", showsCQ: "5", deals: "3", cash: "$11,291", show: "77.8%", close: "60.0%", upDeals: true, upCash: true },
  { closer: "Destiny", prospects: "13", prosD: "12", sDQ: "1", cDQ: "1", prosSQ: "11", showsSQ: "7", showsCQ: "6", deals: "3", cash: "$10,494", show: "63.6%", close: "50.0%" },
  { closer: "Ben", prospects: "12", prosD: "11", sDQ: "2", cDQ: "0", prosSQ: "10", showsSQ: "8", showsCQ: "8", deals: "3", cash: "$8,494", show: "80.0%", close: "37.5%", upShow: true },
  { closer: "Johanna", prospects: "15", prosD: "14", sDQ: "4", cDQ: "1", prosSQ: "9", showsSQ: "5", showsCQ: "4", deals: "3", cash: "$5,997", show: "55.6%", close: "75.0%", upClose: true },
  { closer: "Morgan", prospects: "16", prosD: "16", sDQ: "3", cDQ: "1", prosSQ: "10", showsSQ: "8", showsCQ: "7", deals: "1", cash: "$5,497", show: "80.0%", close: "14.3%", upShow: true },
  { closer: "Jordan", prospects: "4", prosD: "3", sDQ: "0", cDQ: "0", prosSQ: "2", showsSQ: "1", showsCQ: "1", deals: "0", cash: "$0", show: "50.0%", close: "0.0%" },
  { closer: "Cecilia", prospects: "10", prosD: "9", sDQ: "3", cDQ: "0", prosSQ: "6", showsSQ: "3", showsCQ: "3", deals: "0", cash: "$0", show: "50.0%", close: "0.0%", dnDeals: true, dnCash: true, dnClose: true },
];

export const CLOSER_OVERALL_TOTAL = {
  label: "All Sales",
  prospects: "84",
  prosD: "76",
  sDQ: "14",
  cDQ: "5",
  prosSQ: "57",
  showsSQ: "39",
  showsCQ: "34",
  deals: "13",
  cash: "$41,772",
  show: "68.4%",
  close: "38.2%",
};

export const CLOSER_WOW = [
  { closer: "Tyler", deals: "3 ↑", cash: "$11,291", priorDeals: "3", priorCash: "$8,991", upDeals: true, upCash: true },
  { closer: "Destiny", deals: "3", cash: "$10,494", priorDeals: "4", priorCash: "$11,852" },
  { closer: "Ben", deals: "3", cash: "$8,494", priorDeals: "3", priorCash: "$9,993" },
  { closer: "Johanna", deals: "3 ↑", cash: "$5,997", priorDeals: "1", priorCash: "$4,997", upDeals: true },
  { closer: "Morgan", deals: "1", cash: "$5,497", priorDeals: "1", priorCash: "$4,997" },
  { closer: "Cecilia", deals: "0 ↓", cash: "$0", priorDeals: "2", priorCash: "$9,994", dnDeals: true, dnCash: true },
  { closer: "Jordan", deals: "0", cash: "$0", priorDeals: "1", priorCash: "$4,997" },
  { closer: "Luke", deals: "0", cash: "$0", priorDeals: "0", priorCash: "$0" },
];

export const BOOKING_MODE = [
  { source: "Webinar Booked", tip: "is_webinar_flow = true\nfinal_marketing_flow IN ('Wednesday Webinar','Webinar','Post-Attendee Webinar Typeform')", prospects: "53", prosSQ: "34", showsSQ: "22", showRate: "64.7%", showsCQ: "18", deals: "8", cash: "$22,785", close: "44.4%" },
  { source: "Setter Booked", tip: "is_setter_flow = true\nfinal_marketing_flow = 'Setter Booked'", prospects: "28", prosSQ: "21", showsSQ: "15", showRate: "71.4%", showsCQ: "14", deals: "5", cash: "$18,988", close: "35.7%", upShow: true },
  { source: "Other", prospects: "4", prosSQ: "2", showsSQ: "2", showRate: "100%", showsCQ: "2", deals: "0", cash: "$0", close: "0.0%" },
];

export type SetterModeRow = {
  mode: string;
  prosSQ: string;
  showsSQ: string;
  show: string;
  deals: string;
  cash: string;
  upShow?: boolean;
  dnShow?: boolean;
};

export type SetterPerfBlock = {
  name: string;
  rows: SetterModeRow[];
  bonus: { label: string; tone: "dn" | "amb" | "up"; tip: string };
  combined: string;
};

export const SETTER_PERF: SetterPerfBlock[] = [
  {
    name: "Swapnil",
    rows: [
      { mode: "Setter", prosSQ: "8", showsSQ: "4", show: "50.0%", deals: "1", cash: "$5,497", dnShow: true },
      { mode: "Webinar", prosSQ: "22", showsSQ: "17", show: "77.3%", deals: "6", cash: "$18,988", upShow: true },
    ],
    bonus: { label: "✗ SR", tone: "dn", tip: "Overall SR: 21/30 = 70.0% — below 80%.\nPros (SQ): 30 — volume OK.\nNeeds +10pp on SR to qualify." },
    combined: "Swapnil Combined: 30 Pros (SQ) · 21 Shows (SQ) · 70.0% SR · 7 deals · $24,485",
  },
  {
    name: "Hania",
    rows: [
      { mode: "Setter", prosSQ: "9", showsSQ: "7", show: "77.8%", deals: "3", cash: "$8,494", upShow: true },
      { mode: "Webinar", prosSQ: "10", showsSQ: "4", show: "40.0%", deals: "2", cash: "$3,797", dnShow: true },
    ],
    bonus: { label: "✗ SR+Vol", tone: "dn", tip: "Overall SR: 11/19 = 57.9% — well below 80%.\nPros (SQ): 19 — below 20 threshold.\nWebinar-sourced SR (40%) dragging overall down." },
    combined: "Hania Combined: 19 Pros (SQ) · 11 Shows (SQ) · 57.9% SR · 5 deals · $12,291",
  },
  {
    name: "Sal",
    rows: [
      { mode: "Setter", prosSQ: "4", showsSQ: "4", show: "100%", deals: "1", cash: "$4,997", upShow: true },
      { mode: "Webinar", prosSQ: "3", showsSQ: "2", show: "66.7%", deals: "0", cash: "$0" },
    ],
    bonus: { label: "✗ Vol", tone: "amb", tip: "Overall SR: 6/7 = 85.7% — clears 80%.\nPros (SQ): 7 — well below 20 threshold.\nReturning from trip, building volume." },
    combined: "Sal Combined: 7 Pros (SQ) · 6 Shows (SQ) · 85.7% SR · 1 deal · $4,997",
  },
];

// ---------- TAB 3: STRATEGIC INSIGHTS ----------

export type Insight = {
  tone: "ctx" | "win" | "watch" | "flag" | "fix" | "fwd";
  tag: string;
  title: string;
  body: string;
};

export const INSIGHTS: Insight[] = [
  {
    tone: "ctx",
    tag: "Context",
    title: "May 10 Comparability: Structural Changes Limit Direct Cycle Comparison",
    body: "May 10 used an expanded 5-cycle reactivation pool (3,705 contacts vs typical 500–700) and enrolled them as Zoom registrants for the first time — total Zoom enrollment 4,160. Attendee count (183), attend rate (19.1% GHL / 4.4% Zoom), and cost/attendee ($32.27 adjusted) are not comparable to prior cycles. Ad spend approximated at ~$5,906 (12pm ET cutoff, daily-grain only). 1 deal confirmed at report pull — cycle evaluation at Thursday's midweek report.",
  },
  {
    tone: "win",
    tag: "Win — Marketing",
    title: "Meta CPL Down 70% Over 3 Windows — Confirmed Real, Not Attribution Noise",
    body: "Main campaign: $69.37 → $25.83 → $20.65. GHL registrants holding at 800–960/webinar, confirming genuine efficiency improvement in the new ad account. May 10 delivered 960 GHL regs — highest since Apr 26's 1,334 spike. Broad T1 also improved from $42.73 to $26.18.",
  },
  {
    tone: "win",
    tag: "Win — Sales",
    title: "Show Rate +9.8pp to 68.4% and Setter DQ Down 52% — Funnel Quality Improving",
    body: "Show rate rose from 58.6% to 68.4% (+9.8pp) and Setter DQ fell from 29 to 14 (−51.7%). This is the strongest show rate improvement in the tracked period. Better-qualified leads are reaching the calendar and showing up at a significantly higher rate. Monitor over 2–3 more cycles to confirm the improvement is structural.",
  },
  {
    tone: "win",
    tag: "Win — Sales",
    title: "Four Closers at 3 Deals Each — Distributed Week, Tyler Leads on Cash",
    body: "Tyler, Destiny, Ben, and Johanna each closed 3 deals. Tyler leads on cash ($11,291) with two delayed closes from prior booking weeks landing this week. Johanna leads on close rate (75% on Shows (CQ)). Ben posted 80% show rate. The distribution is healthy — this week's revenue gap vs prior is primarily a pipeline volume story, not individual execution.",
  },
  {
    tone: "watch",
    tag: "Watch — Sales",
    title: "Deal Volume −31.6%, Cash −36.2% — Pipeline Volume Lighter This Cycle",
    body: "13 deals vs 19 prior week (−31.6%); cash $41,772 vs $65,416 (−36.2%). Close rate held near 38% (vs 40.4%). The gap is volume-driven: 84 prospects vs 122 prior (−31.1%) and 57 Prospects (SQ) vs 87 (−34.5%). May 10's expanded reactivation (42 booked, 17 from reactivation pool) is the planned corrective — monitor qualified show-up count at Thursday's midweek report.",
  },
  {
    tone: "watch",
    tag: "Watch — Finance",
    title: "AOV Down −6.7%, Collection Rate −10pp — Payment Plan Mix Shifting",
    body: "AOV: $3,443 → $3,213 while ACV improved to $4,228 (+5.8%). Contract values are actually stronger, but cash per deal is lower — indicating higher payment plan uptake. Cash collection rate fell from 86.1% to 76.0% (−10pp). Finance should track receivables from this week's 13 closes. Not a pricing concern — a payment structure mix issue.",
  },
  {
    tone: "watch",
    tag: "Watch — Ops & Analytics",
    title: "Hania's Webinar-Sourced Show Rate at 40% — Clear Gap vs Setter-Booked (77.8%)",
    body: "Hania achieves 77.8% show rate on her own setter-booked calls but only 40.0% on webinar-assigned leads. Overall 57.9% is the weakest on the setter team and well below the 80% bonus threshold. This may reflect lead quality differences post-webinar vs setter-qualified, or a nurturing gap. Needs investigation before attributing entirely to lead quality.",
  },
  {
    tone: "flag",
    tag: "Flag — Sales",
    title: "Cecilia: 0 Deals, 50% Show Rate — Two Consecutive Difficult Weeks",
    body: "0 deals from 10 assigned this week (6 Prospects (SQ), 3 Shows (SQ), 3 Shows (CQ)); 0 deals last week also. 3 of 10 were Setter DQ. Show rate 50% is also below team average. Sales management review recommended to diagnose call approach vs lead fit — both show rate and conversion are below expectations.",
  },
  {
    tone: "flag",
    tag: "Flag — Marketing",
    title: '"Hammer Them 1" Campaign: 0 Conversions Across All 3 Tracked Windows — $1,582 Spent',
    body: "0 Meta-reported conversions in May 10 ($774.97), May 3 ($509.92), and Apr 26 ($296.34) promo windows. Clicks near-zero across all three — the ad likely isn't serving effectively. Marketing should audit creative and audience targeting, or pause and redirect budget to the two performing campaigns.",
  },
  {
    tone: "fix",
    tag: "Fix Underway — Ops & Analytics",
    title: "India Lead Filter Live — Setter DQ Already Down 52% as Early Signal",
    body: "Country selector being implemented in the ManyChat qualification flow. Setter DQ dropped from 29 to 14 this week (−51.7%) — may partially reflect early filter impact. Watch Setter DQ rate over 2–3 more cycles for sustained improvement below 15%. If it returns toward 25%, additional funnel intervention needed.",
  },
  {
    tone: "fix",
    tag: "Fix Underway — Ops & Analytics",
    title: "Show Rate Bonus Launched ($300/wk) — No Setter Qualified This Week",
    body: "Threshold: 80%+ SR AND 20+ Pros (SQ). Sal clears SR (85.7%) but volume short (7 SQ, post-trip). Swapnil has volume (30 SQ) but SR at 70%. Hania misses both (57.9% SR, 19 SQ). Clearest levers: Hania's nurturing of webinar-assigned leads, and Swapnil's setter-booked commitment rate (50% → 80% target).",
  },
  {
    tone: "fwd",
    tag: "Forward Signal",
    title: "May 10 Pipeline: 42 Booked, 17 from Reactivation — Projects ~7 Deals Next Week",
    body: "42 calls booked (32 active) from May 10 as of report pull. Reactivation contributed 17 bookings from 86 attendees (19.8% post-attend booking rate). At this week's show rate (68.4%) and close rate (38.2%), the May 10 pipeline projects ~7–8 deals and $22–30k cash. Any prior-booking-week delayed closes landing next week (as happened this week) would add upside. Monitor call held count and early deals Thursday — Mother's Day timing may shift the window.",
  },
];
