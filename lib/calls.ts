// Canonical query layer for `int_calls_enriched` — the source of truth
// for the rebuilt Sales (D2) and Setter (D3) dashboards.
//
// Design contract:
//
//   • ONE BigQuery query per page-load. SELECT every column the dashboards
//     need; do all rollups + cross-filter pivots in JavaScript. This is
//     what makes Looker-style 6-dimension cross-filtering feel instant —
//     the user is filtering an already-loaded array, not bouncing back to
//     BQ for every chip click.
//
//   • Every funnel count is `COUNT_DISTINCT(prospect_email_lc)`. Matches
//     the Looker dashboard's semantics exactly; deduplicates prospects
//     who booked, cancelled, and rebooked within the period.
//
//   • Mandatory email exclusion on every query (per
//     `bi_weekly_report_spec_v9.md` in the analytics repo):
//        prospect_email_lc NOT LIKE '%@nomoremondays.io%'
//        AND prospect_email_lc NOT IN
//            ('jaromir1998@gmail.com', 'marek@sintano.com')
//
//   • PR-#43 `is_show_up` is used everywhere (excludes Setter DQs);
//     `is_call_held` is intentionally NOT exposed. The old
//     `lib/sales.ts` still queries the mart that derives from
//     `is_call_held` — keep that until D2 swaps the dashboard over.

import { bq } from "./bq";

const INT_CALLS_ENRICHED =
  "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

// =====================================================================
// Public types
// =====================================================================

export type DateDim = "appointment" | "closed";
export type OccFuc = "OCC" | "FUC";

export type CallsFilter = {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
  /** Which date column to range-filter on. Defaults to "appointment". */
  dateDim?: DateDim;
  // Cross-filter dimensions (all optional, all combinable).
  source?: string;        // final_marketing_flow
  closer?: string;        // closer_owner
  setter?: string;        // COALESCE(setter_owner, calendly_setter_name)
  triageCaller?: string;  // triage_caller
  callOutcome?: string;   // call_status_category
  occFuc?: OccFuc;        // close_type
  /** Substring match on prospect_email_lc (case-insensitive at the DB). */
  emailLike?: string;
};

export type CallRow = {
  // Identity
  prospect_email_lc: string | null;
  prospect_name: string | null;
  // Attribution
  closer_owner: string | null;
  setter_owner: string | null;
  calendly_setter_name: string | null;
  triage_caller: string | null;
  final_marketing_flow: string | null;
  airtable_source: string | null;
  // Timeline
  appointment_date_time: string | null; // ISO timestamp
  call_date_time: string | null;
  date_closed: string | null;           // YYYY-MM-DD
  // Disposition
  call_status_category: string | null;
  call_outcome: string | null;
  not_taken_category: string | null;
  loss_reason_display: string | null;
  closer_dq_reasons: string | null;
  // Close attributes
  close_type: string | null;            // 'OCC' | 'FUC'
  close_path_tag: string | null;
  held_call_number: number | null;
  payment_type: string | null;
  product: string | null;
  payment_notes: string | null;
  // Flags
  is_call_booked: boolean;
  is_dispositioned: boolean;
  is_show_rate_eligible: boolean;
  is_show_up: boolean;
  is_close_rate_eligible: boolean;
  is_deal: boolean;
  is_deposit: boolean;
  is_paid_in_full: boolean;
  is_canceled: boolean;
  is_canceled_by_prospect: boolean;
  is_rescheduled: boolean;
  is_ghosted: boolean;
  // Money (NUMERIC in BQ → number | null)
  cash_collected: number | null;
  revenue_generated: number | null;
  deposit_collected: number | null;
  // Cycle
  booking_to_close_days: number | null;
  first_call_to_close_days: number | null;
};

export type FilterOptions = {
  sources: string[];
  closers: string[];
  setters: string[];
  triageCallers: string[];
  callOutcomes: string[];
  occFucs: OccFuc[];
};

// =====================================================================
// BigQuery value normalization — same conventions as lib/sales.ts.
// =====================================================================

function unwrap(v: unknown): unknown {
  if (
    v != null &&
    typeof v === "object" &&
    "value" in (v as Record<string, unknown>)
  ) {
    return (v as { value: unknown }).value;
  }
  return v;
}
function asStr(v: unknown): string | null {
  const u = unwrap(v);
  return u == null ? null : String(u);
}
function asNum(v: unknown): number | null {
  const u = unwrap(v);
  if (u == null || u === "") return null;
  const n = Number(u);
  return Number.isFinite(n) ? n : null;
}
function asBool(v: unknown): boolean {
  const u = unwrap(v);
  return u === true || u === "true";
}
function asDate(v: unknown): string | null {
  const s = asStr(v);
  return s ? s.slice(0, 10) : null;
}

function toCallRow(row: Record<string, unknown>): CallRow {
  return {
    prospect_email_lc: asStr(row.prospect_email_lc),
    prospect_name: asStr(row.prospect_name),
    closer_owner: asStr(row.closer_owner),
    setter_owner: asStr(row.setter_owner),
    calendly_setter_name: asStr(row.calendly_setter_name),
    triage_caller: asStr(row.triage_caller),
    final_marketing_flow: asStr(row.final_marketing_flow),
    airtable_source: asStr(row.airtable_source),
    appointment_date_time: asStr(row.appointment_date_time),
    call_date_time: asStr(row.call_date_time),
    date_closed: asDate(row.date_closed),
    call_status_category: asStr(row.call_status_category),
    call_outcome: asStr(row.call_outcome),
    not_taken_category: asStr(row.not_taken_category),
    loss_reason_display: asStr(row.loss_reason_display),
    closer_dq_reasons: asStr(row.closer_dq_reasons),
    close_type: asStr(row.close_type),
    close_path_tag: asStr(row.close_path_tag),
    held_call_number: asNum(row.held_call_number),
    payment_type: asStr(row.payment_type),
    product: asStr(row.product),
    payment_notes: asStr(row.payment_notes),
    is_call_booked: asBool(row.is_call_booked),
    is_dispositioned: asBool(row.is_dispositioned),
    is_show_rate_eligible: asBool(row.is_show_rate_eligible),
    is_show_up: asBool(row.is_show_up),
    is_close_rate_eligible: asBool(row.is_close_rate_eligible),
    is_deal: asBool(row.is_deal),
    is_deposit: asBool(row.is_deposit),
    is_paid_in_full: asBool(row.is_paid_in_full),
    is_canceled: asBool(row.is_canceled),
    is_canceled_by_prospect: asBool(row.is_canceled_by_prospect),
    is_rescheduled: asBool(row.is_rescheduled),
    is_ghosted: asBool(row.is_ghosted),
    cash_collected: asNum(row.cash_collected),
    revenue_generated: asNum(row.revenue_generated),
    deposit_collected: asNum(row.deposit_collected),
    booking_to_close_days: asNum(row.booking_to_close_days),
    first_call_to_close_days: asNum(row.first_call_to_close_days),
  };
}

// =====================================================================
// The single canonical query.
// =====================================================================

const SELECT_LIST = `
  prospect_email_lc, prospect_name,
  closer_owner, setter_owner, calendly_setter_name, triage_caller,
  final_marketing_flow, airtable_source,
  appointment_date_time, call_date_time, date_closed,
  call_status_category, call_outcome, not_taken_category,
  loss_reason_display, closer_dq_reasons,
  close_type, close_path_tag, held_call_number,
  payment_type, product, payment_notes,
  is_call_booked, is_dispositioned, is_show_rate_eligible, is_show_up,
  is_close_rate_eligible, is_deal, is_deposit, is_paid_in_full,
  is_canceled, is_canceled_by_prospect, is_rescheduled, is_ghosted,
  cash_collected, revenue_generated, deposit_collected,
  booking_to_close_days, first_call_to_close_days
`;

export async function getCalls(filter: CallsFilter): Promise<CallRow[]> {
  const dateDim = filter.dateDim ?? "appointment";
  const dateColumn =
    dateDim === "closed" ? "date_closed" : "DATE(appointment_date_time)";
  const params = {
    from: filter.from,
    to: filter.to,
    source: filter.source || null,
    closer: filter.closer || null,
    setter: filter.setter || null,
    triage: filter.triageCaller || null,
    call_outcome: filter.callOutcome || null,
    occ_fuc: filter.occFuc || null,
    email_like: filter.emailLike || null,
  };
  const [rows] = await bq().query({
    query: `
      SELECT ${SELECT_LIST}
      FROM ${INT_CALLS_ENRICHED}
      WHERE ${dateColumn} BETWEEN DATE(@from) AND DATE(@to)
        AND prospect_email_lc IS NOT NULL
        AND prospect_email_lc NOT LIKE '%@nomoremondays.io%'
        AND prospect_email_lc NOT IN ('jaromir1998@gmail.com', 'marek@sintano.com')
        AND (@source IS NULL OR final_marketing_flow = @source)
        AND (@closer IS NULL OR closer_owner = @closer)
        AND (@setter IS NULL OR COALESCE(setter_owner, calendly_setter_name) = @setter)
        AND (@triage IS NULL OR triage_caller = @triage)
        AND (@call_outcome IS NULL OR call_status_category = @call_outcome)
        AND (@occ_fuc IS NULL OR close_type = @occ_fuc)
        AND (@email_like IS NULL OR LOWER(prospect_email_lc) LIKE LOWER(CONCAT('%', @email_like, '%')))
      ORDER BY appointment_date_time DESC`,
    params,
    types: {
      from: "STRING",
      to: "STRING",
      source: "STRING",
      closer: "STRING",
      setter: "STRING",
      triage: "STRING",
      call_outcome: "STRING",
      occ_fuc: "STRING",
      email_like: "STRING",
    },
  });
  return (rows as Record<string, unknown>[]).map(toCallRow);
}

// =====================================================================
// Filter-options derivation (avoid a second query for dropdown choices).
// =====================================================================

/** Distinct values for each cross-filter dimension. Computed from an
 *  UNFILTERED set if possible (caller's responsibility) so chips don't
 *  shrink as the user narrows the table. */
export function deriveFilterOptions(rows: CallRow[]): FilterOptions {
  const sources = new Set<string>();
  const closers = new Set<string>();
  const setters = new Set<string>();
  const triageCallers = new Set<string>();
  const callOutcomes = new Set<string>();
  const occFucs = new Set<OccFuc>();

  for (const r of rows) {
    if (r.final_marketing_flow) sources.add(r.final_marketing_flow);
    if (r.closer_owner) closers.add(r.closer_owner);
    const setter = r.setter_owner ?? r.calendly_setter_name;
    if (setter) setters.add(setter);
    if (r.triage_caller) triageCallers.add(r.triage_caller);
    if (r.call_status_category) callOutcomes.add(r.call_status_category);
    if (r.close_type === "OCC" || r.close_type === "FUC") {
      occFucs.add(r.close_type);
    }
  }

  const sorted = <T,>(s: Set<T>) =>
    Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));

  return {
    sources: sorted(sources),
    closers: sorted(closers),
    setters: sorted(setters),
    triageCallers: sorted(triageCallers),
    callOutcomes: sorted(callOutcomes),
    occFucs: sorted(occFucs),
  };
}

// =====================================================================
// Funnel counts — COUNT_DISTINCT(prospect_email_lc) semantics throughout.
// =====================================================================

export type FunnelCounts = {
  prospects: number;             // every prospect that booked in the window
  pending_dispo: number;         // booked, not yet dispositioned
  dispositioned: number;         // is_dispositioned
  setter_dq: number;             // call_outcome = 'Setter DQ'
  rescheduled: number;           // is_rescheduled
  prospects_sq: number;          // is_show_rate_eligible (sales-qualified)
  no_shows: number;              // is_ghosted
  canceled_by_prospect: number;  // is_canceled_by_prospect
  canceled: number;              // is_canceled
  shows_sq: number;              // is_show_up
  closer_dq: number;             // call_outcome = 'Closer DQ'
  shows_cq: number;              // is_close_rate_eligible (closer-qualified)
  deposits: number;              // is_deposit
  deals: number;                 // is_deal
};

const countDistinctEmail = (
  rows: CallRow[],
  predicate: (r: CallRow) => boolean,
): number => {
  const set = new Set<string>();
  for (const r of rows) {
    if (!r.prospect_email_lc) continue;
    if (predicate(r)) set.add(r.prospect_email_lc);
  }
  return set.size;
};

export function computeFunnelCounts(rows: CallRow[]): FunnelCounts {
  return {
    prospects: countDistinctEmail(rows, () => true),
    pending_dispo: countDistinctEmail(rows, (r) => !r.is_dispositioned),
    dispositioned: countDistinctEmail(rows, (r) => r.is_dispositioned),
    setter_dq: countDistinctEmail(rows, (r) => r.call_outcome === "Setter DQ"),
    rescheduled: countDistinctEmail(rows, (r) => r.is_rescheduled),
    prospects_sq: countDistinctEmail(rows, (r) => r.is_show_rate_eligible),
    no_shows: countDistinctEmail(rows, (r) => r.is_ghosted),
    canceled_by_prospect: countDistinctEmail(rows, (r) => r.is_canceled_by_prospect),
    canceled: countDistinctEmail(rows, (r) => r.is_canceled),
    shows_sq: countDistinctEmail(rows, (r) => r.is_show_up),
    closer_dq: countDistinctEmail(rows, (r) => r.call_outcome === "Closer DQ"),
    shows_cq: countDistinctEmail(rows, (r) => r.is_close_rate_eligible),
    deposits: countDistinctEmail(rows, (r) => r.is_deposit),
    deals: countDistinctEmail(rows, (r) => r.is_deal),
  };
}

// =====================================================================
// KPI strip — 13 cells, dollar volumes + conversion rates + medians.
// =====================================================================

export type CallsKpis = {
  // Money — summed over deal rows only.
  cash: number;
  tcv: number;                   // total contract value = SUM(revenue_generated) on deals
  aov: number | null;            // average order value = cash / deals
  acv: number | null;            // average contract value = tcv / deals
  // Per-prospect economics
  dollars_per_dispositioned: number | null;  // cash / dispositioned prospects
  dollars_per_sq: number | null;             // cash / SQ prospects
  // Conversion rates
  dispositioned_to_cq_rate: number | null;   // shows_cq / dispositioned
  cq_to_close_rate: number | null;           // deals / shows_cq
  sq_to_sq_rate: number | null;              // shows_sq / prospects_sq (i.e. SQ show rate)
  dispositioned_to_close_rate: number | null;// deals / dispositioned
  // Cycle medians (days)
  median_booking_to_close: number | null;
  median_first_call_to_close: number | null;
  // OCC share
  occ_rate: number | null;       // OCC deals / total deals
};

const div = (n: number, d: number): number | null => (d > 0 ? n / d : null);

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeKpis(rows: CallRow[]): CallsKpis {
  const f = computeFunnelCounts(rows);

  let cash = 0;
  let tcv = 0;
  let occDeals = 0;
  const cycleBook: number[] = [];
  const cycleFirst: number[] = [];

  for (const r of rows) {
    if (r.is_deal) {
      cash += r.cash_collected ?? 0;
      tcv += r.revenue_generated ?? 0;
      if (r.close_type === "OCC") occDeals += 1;
      if (typeof r.booking_to_close_days === "number") {
        cycleBook.push(r.booking_to_close_days);
      }
      if (typeof r.first_call_to_close_days === "number") {
        cycleFirst.push(r.first_call_to_close_days);
      }
    }
  }

  return {
    cash,
    tcv,
    aov: div(cash, f.deals),
    acv: div(tcv, f.deals),
    dollars_per_dispositioned: div(cash, f.dispositioned),
    dollars_per_sq: div(cash, f.prospects_sq),
    dispositioned_to_cq_rate: div(f.shows_cq, f.dispositioned),
    cq_to_close_rate: div(f.deals, f.shows_cq),
    sq_to_sq_rate: div(f.shows_sq, f.prospects_sq),
    dispositioned_to_close_rate: div(f.deals, f.dispositioned),
    median_booking_to_close: median(cycleBook),
    median_first_call_to_close: median(cycleFirst),
    occ_rate: div(occDeals, f.deals),
  };
}

// =====================================================================
// Closer / Setter rollups
// =====================================================================

export type CloserRollup = {
  closer: string;
  prospects: number;
  dispositioned: number;
  prospects_sq: number;
  shows_sq: number;
  shows_cq: number;
  deposits: number;
  deals: number;
  cash: number;
  tcv: number;
  deposit_collected: number;
  aov: number | null;
  acv: number | null;
  show_rate: number | null;     // shows_sq / prospects_sq
  close_rate: number | null;    // deals / shows_cq
};

export type SetterRollup = {
  setter: string;
  bookings: number;             // every prospect they booked
  dispositioned: number;
  setter_dq: number;
  prospects_sq: number;
  shows_sq: number;
  shows_cq: number;
  closer_dq: number;
  deals: number;
  cash: number;
  setter_dq_rate: number | null;     // setter_dq / dispositioned
  show_rate: number | null;
  cash_per_booking: number | null;
};

export function rollupByCloser(rows: CallRow[]): CloserRollup[] {
  // Group by closer_owner; rows with no closer are dropped from the
  // leaderboard (they show up in the call drill-through).
  const groups = new Map<string, CallRow[]>();
  for (const r of rows) {
    if (!r.closer_owner) continue;
    let g = groups.get(r.closer_owner);
    if (!g) {
      g = [];
      groups.set(r.closer_owner, g);
    }
    g.push(r);
  }

  const out: CloserRollup[] = [];
  for (const [closer, grp] of groups) {
    const f = computeFunnelCounts(grp);
    let cash = 0;
    let tcv = 0;
    let deposit_collected = 0;
    for (const r of grp) {
      if (r.is_deal) {
        cash += r.cash_collected ?? 0;
        tcv += r.revenue_generated ?? 0;
      }
      if (r.is_deposit && !r.is_deal) {
        deposit_collected += r.deposit_collected ?? 0;
      }
    }
    out.push({
      closer,
      prospects: f.prospects,
      dispositioned: f.dispositioned,
      prospects_sq: f.prospects_sq,
      shows_sq: f.shows_sq,
      shows_cq: f.shows_cq,
      deposits: f.deposits,
      deals: f.deals,
      cash,
      tcv,
      deposit_collected,
      aov: div(cash, f.deals),
      acv: div(tcv, f.deals),
      show_rate: div(f.shows_sq, f.prospects_sq),
      close_rate: div(f.deals, f.shows_cq),
    });
  }
  return out.sort((a, b) => b.cash - a.cash);
}

export function rollupBySetter(rows: CallRow[]): SetterRollup[] {
  // setter = COALESCE(setter_owner, calendly_setter_name)
  const groups = new Map<string, CallRow[]>();
  for (const r of rows) {
    const setter = r.setter_owner ?? r.calendly_setter_name;
    if (!setter) continue;
    let g = groups.get(setter);
    if (!g) {
      g = [];
      groups.set(setter, g);
    }
    g.push(r);
  }

  const out: SetterRollup[] = [];
  for (const [setter, grp] of groups) {
    const f = computeFunnelCounts(grp);
    let cash = 0;
    for (const r of grp) {
      if (r.is_deal) cash += r.cash_collected ?? 0;
    }
    // "bookings" = every unique prospect the setter booked, regardless of
    // disposition state. Matches Looker's "Bookings" column.
    const bookings = countDistinctEmail(grp, (r) => r.is_call_booked);
    out.push({
      setter,
      bookings,
      dispositioned: f.dispositioned,
      setter_dq: f.setter_dq,
      prospects_sq: f.prospects_sq,
      shows_sq: f.shows_sq,
      shows_cq: f.shows_cq,
      closer_dq: f.closer_dq,
      deals: f.deals,
      cash,
      setter_dq_rate: div(f.setter_dq, f.dispositioned),
      show_rate: div(f.shows_sq, f.prospects_sq),
      cash_per_booking: div(cash, bookings),
    });
  }
  return out.sort((a, b) => b.bookings - a.bookings);
}

// =====================================================================
// Sales-cycle medians (standalone for cards that want { value, n })
// =====================================================================

export function medianBookingToClose(rows: CallRow[]): {
  value: number | null;
  n: number;
} {
  const vals: number[] = [];
  for (const r of rows) {
    if (r.is_deal && typeof r.booking_to_close_days === "number") {
      vals.push(r.booking_to_close_days);
    }
  }
  return { value: median(vals), n: vals.length };
}

export function medianFirstCallToClose(rows: CallRow[]): {
  value: number | null;
  n: number;
} {
  const vals: number[] = [];
  for (const r of rows) {
    if (r.is_deal && typeof r.first_call_to_close_days === "number") {
      vals.push(r.first_call_to_close_days);
    }
  }
  return { value: median(vals), n: vals.length };
}

// =====================================================================
// Freshness — `int_calls_enriched` doesn't carry a `dbt_updated_at`
// column (it's an intermediate model, not a mart). Source freshness from
// BigQuery's `__TABLES__` metadata instead so the <DataFreshness> pill
// still has something accurate to show. Result is cached per-process
// for 60 seconds so we don't hit metadata BQ on every page-load.
// =====================================================================

let _freshnessCache: { value: string | null; expiresAt: number } | null = null;
const FRESHNESS_TTL_MS = 60_000;

export async function getCallsTableFreshness(): Promise<string | null> {
  const now = Date.now();
  if (_freshnessCache && _freshnessCache.expiresAt > now) {
    return _freshnessCache.value;
  }
  try {
    const [rows] = await bq().query({
      query: `
        SELECT TIMESTAMP_MILLIS(last_modified_time) AS last_modified
        FROM \`no-more-mondays-analytics.dbt_tuddin.__TABLES__\`
        WHERE table_id = 'int_calls_enriched'`,
    });
    const v = asStr(
      (rows as Record<string, unknown>[])[0]?.last_modified,
    );
    _freshnessCache = { value: v, expiresAt: now + FRESHNESS_TTL_MS };
    return v;
  } catch {
    _freshnessCache = { value: null, expiresAt: now + FRESHNESS_TTL_MS };
    return null;
  }
}
