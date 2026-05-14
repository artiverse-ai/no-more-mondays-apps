// Snapshot registry + editorial content (context banner, strategic insights)
// for the Weekly Report dashboard. Replaces the previous per-folder data.ts
// files. Two BigQuery tables in nmm_calendar, auto-created on first call
// via CREATE TABLE IF NOT EXISTS — no manual migration needed.

import crypto from "node:crypto";
import { bq, table } from "./bq";

export type ReportType = "weekly_recap" | "midweek_check";
export type InsightsGenStatus = "pending" | "generating" | "succeeded" | "failed";

export type Snapshot = {
  slug: string;
  runOn: string; // YYYY-MM-DD
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  reportType: ReportType;
  weekLabel: string;
  badge: string;
  latestWebinar: string | null;
  contextTag: string | null;
  contextTitle: string | null;
  contextBody: string | null; // optional narrative
  insightsGenerationStatus: InsightsGenStatus;
  insightsGeneratedAt: string | null;
  insightsGenerationError: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type Insight = {
  id: string;
  snapshotSlug: string;
  tone: "ctx" | "win" | "watch" | "flag" | "fix" | "fwd";
  tag: string;
  title: string;
  body: string;
  position: number;
  createdAt: string;
  updatedAt: string | null;
};

const SNAPSHOTS = table("weekly_report_snapshots");
const INSIGHTS = table("weekly_report_insights");

let _ready = false;
async function ensure(): Promise<void> {
  if (_ready) return;
  await bq().query({
    query: `CREATE TABLE IF NOT EXISTS ${SNAPSHOTS} (
      slug STRING NOT NULL,
      run_on DATE NOT NULL,
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      report_type STRING NOT NULL,
      week_label STRING NOT NULL,
      badge STRING NOT NULL,
      latest_webinar STRING,
      context_tag STRING,
      context_title STRING,
      context_body STRING,
      insights_generation_status STRING,
      insights_generated_at TIMESTAMP,
      insights_generation_error STRING,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      deleted_at TIMESTAMP
    )`,
  });
  // For tables created before these columns existed, add them idempotently.
  await bq().query({
    query: `ALTER TABLE ${SNAPSHOTS}
      ADD COLUMN IF NOT EXISTS insights_generation_status STRING,
      ADD COLUMN IF NOT EXISTS insights_generated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS insights_generation_error STRING`,
  });
  await bq().query({
    query: `CREATE TABLE IF NOT EXISTS ${INSIGHTS} (
      id STRING NOT NULL,
      snapshot_slug STRING NOT NULL,
      tone STRING NOT NULL,
      tag STRING NOT NULL,
      title STRING NOT NULL,
      body STRING NOT NULL,
      position INT64 NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP,
      deleted_at TIMESTAMP
    )`,
  });
  // BigQuery enforces ~1,500 table-update operations per table per day.
  // We previously seeded on every cold start which burned that quota fast
  // (14 MERGE statements x N cold starts). Now we only seed when the
  // snapshots table is genuinely empty — typical case is a fresh dev env.
  const [seedCheck] = await bq().query({
    query: `SELECT COUNT(*) AS n FROM ${SNAPSHOTS} WHERE deleted_at IS NULL`,
  });
  const existingCount = Number((seedCheck[0] as { n?: number | string })?.n ?? 0);
  if (existingCount === 0) {
    await seedInitialSnapshots();
  }
  _ready = true;
}

async function seedInitialSnapshots() {
  // Mon May 11 recap — week May 3-9 (Sun-Sat)
  await mergeSnapshot({
    slug: "2026-05-03",
    runOn: "2026-05-11",
    weekStart: "2026-05-03",
    weekEnd: "2026-05-09",
    reportType: "weekly_recap",
    weekLabel: "Week May 3–9, 2026",
    badge: "MON MAY 11, 2026",
    latestWebinar: "Sun May 10",
    contextTag: "Marketing Context — Sun May 10 Mini Lump Sum Event",
    contextTitle: 'Sun May 10 — "Mini Lump Sum" Make-Up Event (Mother\'s Day)',
    contextBody:
      "Expanded reactivation (3,705 contacts): Multi-cycle no-show pool from webinars starting Apr 22. GHL tag: event: no show-webinar-2026-05-06-mini-lump-sum-reactivation.\n\nZoom enrollment process change (first time): Reactivated contacts enrolled as Zoom registrants — received 1-day + 1-hour reminders. Total Zoom enrollment: 4,160.\n\nAd spend approximated at 12pm ET cutoff: Meta data is daily-grain only. Adjusted attributed spend: ~$5,906.\n\nMother's Day (May 10): External factor likely suppressing same-day booking behaviour.",
  }, "succeeded");
  // Thu May 14 midweek — Sun May 10 - Wed May 13
  await mergeSnapshot({
    slug: "2026-05-14",
    runOn: "2026-05-14",
    weekStart: "2026-05-10",
    weekEnd: "2026-05-13",
    reportType: "midweek_check",
    weekLabel: "Sun May 10 – Wed May 13, 2026 (week-to-date)",
    badge: "THU MAY 14, 2026 · MIDWEEK",
    latestWebinar: "Wed May 13",
    contextTag: "Midweek Context — Week May 10–16",
    contextTitle: "Thursday midweek check — Week May 10–16",
    contextBody:
      "Midweek snapshot — Sun + Wed webinar windows partial. Full recap lands Mon May 18.",
  });
  await seedMay11Insights();
}

// Re-seed the 12 strategic-insight cards that previously lived in
// app/dashboards/weekly-report/2026-05-03/data.ts. Deterministic UUIDv5-ish
// IDs derived from (slug + position) so the MERGE stays idempotent across
// re-deploys. Existing rows (matched by id) are skipped.
async function seedMay11Insights() {
  const rows: Array<Omit<Insight, "id" | "createdAt" | "updatedAt"> & { position: number }> = [
    { position: 0, snapshotSlug: "2026-05-03", tone: "ctx",   tag: "Context",
      title: "May 10 Comparability: Structural Changes Limit Direct Cycle Comparison",
      body: "May 10 used an expanded 5-cycle reactivation pool (3,705 contacts vs typical 500–700) and enrolled them as Zoom registrants for the first time — total Zoom enrollment 4,160. Attendee count (183), attend rate (19.1% GHL / 4.4% Zoom), and cost/attendee ($32.27 adjusted) are not comparable to prior cycles. Ad spend approximated at ~$5,906 (12pm ET cutoff, daily-grain only). 1 deal confirmed at report pull — cycle evaluation at Thursday's midweek report." },
    { position: 1, snapshotSlug: "2026-05-03", tone: "win",   tag: "Win — Marketing",
      title: "Meta CPL Down 70% Over 3 Windows — Confirmed Real, Not Attribution Noise",
      body: "Main campaign: $69.37 → $25.83 → $20.65. GHL registrants holding at 800–960/webinar, confirming genuine efficiency improvement in the new ad account. May 10 delivered 960 GHL regs — highest since Apr 26's 1,334 spike. Broad T1 also improved from $42.73 to $26.18." },
    { position: 2, snapshotSlug: "2026-05-03", tone: "win",   tag: "Win — Sales",
      title: "Show Rate +9.8pp to 68.4% and Setter DQ Down 52% — Funnel Quality Improving",
      body: "Show rate rose from 58.6% to 68.4% (+9.8pp) and Setter DQ fell from 29 to 14 (−51.7%). This is the strongest show rate improvement in the tracked period. Better-qualified leads are reaching the calendar and showing up at a significantly higher rate. Monitor over 2–3 more cycles to confirm the improvement is structural." },
    { position: 3, snapshotSlug: "2026-05-03", tone: "win",   tag: "Win — Sales",
      title: "Four Closers at 3 Deals Each — Distributed Week, Tyler Leads on Cash",
      body: "Tyler, Destiny, Ben, and Johanna each closed 3 deals. Tyler leads on cash ($11,291) with two delayed closes from prior booking weeks landing this week. Johanna leads on close rate (75% on Shows (CQ)). Ben posted 80% show rate. The distribution is healthy — this week's revenue gap vs prior is primarily a pipeline volume story, not individual execution." },
    { position: 4, snapshotSlug: "2026-05-03", tone: "watch", tag: "Watch — Sales",
      title: "Deal Volume −31.6%, Cash −36.2% — Pipeline Volume Lighter This Cycle",
      body: "13 deals vs 19 prior week (−31.6%); cash $41,772 vs $65,416 (−36.2%). Close rate held near 38% (vs 40.4%). The gap is volume-driven: 84 prospects vs 122 prior (−31.1%) and 57 Prospects (SQ) vs 87 (−34.5%). May 10's expanded reactivation (42 booked, 17 from reactivation pool) is the planned corrective — monitor qualified show-up count at Thursday's midweek report." },
    { position: 5, snapshotSlug: "2026-05-03", tone: "watch", tag: "Watch — Finance",
      title: "AOV Down −6.7%, Collection Rate −10pp — Payment Plan Mix Shifting",
      body: "AOV: $3,443 → $3,213 while ACV improved to $4,228 (+5.8%). Contract values are actually stronger, but cash per deal is lower — indicating higher payment plan uptake. Cash collection rate fell from 86.1% to 76.0% (−10pp). Finance should track receivables from this week's 13 closes. Not a pricing concern — a payment structure mix issue." },
    { position: 6, snapshotSlug: "2026-05-03", tone: "watch", tag: "Watch — Ops & Analytics",
      title: "Hania's Webinar-Sourced Show Rate at 40% — Clear Gap vs Setter-Booked (77.8%)",
      body: "Hania achieves 77.8% show rate on her own setter-booked calls but only 40.0% on webinar-assigned leads. Overall 57.9% is the weakest on the setter team and well below the 80% bonus threshold. This may reflect lead quality differences post-webinar vs setter-qualified, or a nurturing gap. Needs investigation before attributing entirely to lead quality." },
    { position: 7, snapshotSlug: "2026-05-03", tone: "flag",  tag: "Flag — Sales",
      title: "Cecilia: 0 Deals, 50% Show Rate — Two Consecutive Difficult Weeks",
      body: "0 deals from 10 assigned this week (6 Prospects (SQ), 3 Shows (SQ), 3 Shows (CQ)); 0 deals last week also. 3 of 10 were Setter DQ. Show rate 50% is also below team average. Sales management review recommended to diagnose call approach vs lead fit — both show rate and conversion are below expectations." },
    { position: 8, snapshotSlug: "2026-05-03", tone: "flag",  tag: "Flag — Marketing",
      title: '"Hammer Them 1" Campaign: 0 Conversions Across All 3 Tracked Windows — $1,582 Spent',
      body: "0 Meta-reported conversions in May 10 ($774.97), May 3 ($509.92), and Apr 26 ($296.34) promo windows. Clicks near-zero across all three — the ad likely isn't serving effectively. Marketing should audit creative and audience targeting, or pause and redirect budget to the two performing campaigns." },
    { position: 9, snapshotSlug: "2026-05-03", tone: "fix",   tag: "Fix Underway — Ops & Analytics",
      title: "India Lead Filter Live — Setter DQ Already Down 52% as Early Signal",
      body: "Country selector being implemented in the ManyChat qualification flow. Setter DQ dropped from 29 to 14 this week (−51.7%) — may partially reflect early filter impact. Watch Setter DQ rate over 2–3 more cycles for sustained improvement below 15%. If it returns toward 25%, additional funnel intervention needed." },
    { position: 10, snapshotSlug: "2026-05-03", tone: "fix",  tag: "Fix Underway — Ops & Analytics",
      title: "Show Rate Bonus Launched ($300/wk) — No Setter Qualified This Week",
      body: "Threshold: 80%+ SR AND 20+ Pros (SQ). Sal clears SR (85.7%) but volume short (7 SQ, post-trip). Swapnil has volume (30 SQ) but SR at 70%. Hania misses both (57.9% SR, 19 SQ). Clearest levers: Hania's nurturing of webinar-assigned leads, and Swapnil's setter-booked commitment rate (50% → 80% target)." },
    { position: 11, snapshotSlug: "2026-05-03", tone: "fwd",  tag: "Forward Signal",
      title: "May 10 Pipeline: 42 Booked, 17 from Reactivation — Projects ~7 Deals Next Week",
      body: "42 calls booked (32 active) from May 10 as of report pull. Reactivation contributed 17 bookings from 86 attendees (19.8% post-attend booking rate). At this week's show rate (68.4%) and close rate (38.2%), the May 10 pipeline projects ~7–8 deals and $22–30k cash. Any prior-booking-week delayed closes landing next week (as happened this week) would add upside. Monitor call held count and early deals Thursday — Mother's Day timing may shift the window." },
  ];

  for (const r of rows) {
    const id = `seed-${r.snapshotSlug}-${String(r.position).padStart(2, "0")}`;
    await bq().query({
      query: `MERGE ${INSIGHTS} t
              USING (SELECT @id AS id) s
              ON t.id = s.id
              WHEN NOT MATCHED THEN
                INSERT (id, snapshot_slug, tone, tag, title, body, position, created_at)
                VALUES (@id, @slug, @tone, @tag, @title, @body, @position, CURRENT_TIMESTAMP())`,
      params: {
        id, slug: r.snapshotSlug, tone: r.tone, tag: r.tag,
        title: r.title, body: r.body, position: r.position,
      },
      types: {
        id: "STRING", slug: "STRING", tone: "STRING", tag: "STRING",
        title: "STRING", body: "STRING", position: "INT64",
      },
    });
  }
}

async function mergeSnapshot(
  s: Omit<Snapshot, "createdAt" | "updatedAt" | "insightsGenerationStatus" | "insightsGeneratedAt" | "insightsGenerationError">,
  initialStatus: InsightsGenStatus = "pending",
) {
  await bq().query({
    query: `MERGE ${SNAPSHOTS} t
            USING (SELECT @slug AS slug) s
            ON t.slug = s.slug AND t.deleted_at IS NULL
            WHEN NOT MATCHED THEN
              INSERT (slug, run_on, week_start, week_end, report_type, week_label, badge,
                      latest_webinar, context_tag, context_title, context_body,
                      insights_generation_status, created_at)
              VALUES (@slug, DATE(@runOn), DATE(@weekStart), DATE(@weekEnd), @reportType,
                      @weekLabel, @badge, @latestWebinar, @contextTag, @contextTitle,
                      @contextBody, @initialStatus, CURRENT_TIMESTAMP())`,
    params: {
      slug: s.slug,
      runOn: s.runOn,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      reportType: s.reportType,
      weekLabel: s.weekLabel,
      badge: s.badge,
      latestWebinar: s.latestWebinar,
      contextTag: s.contextTag,
      contextTitle: s.contextTitle,
      contextBody: s.contextBody,
      initialStatus,
    },
    types: {
      slug: "STRING", runOn: "STRING", weekStart: "STRING", weekEnd: "STRING",
      reportType: "STRING", weekLabel: "STRING", badge: "STRING",
      latestWebinar: "STRING", contextTag: "STRING", contextTitle: "STRING", contextBody: "STRING",
      initialStatus: "STRING",
    },
  });
}

// Reset a snapshot back to 'pending' so the VM cron picks it up again.
// Clears any previous error message and the prior generated_at timestamp.
export async function resetInsightsGeneration(slug: string): Promise<void> {
  await ensure();
  await bq().query({
    query: `UPDATE ${SNAPSHOTS}
            SET insights_generation_status = 'pending',
                insights_generation_error = NULL,
                insights_generated_at = NULL,
                updated_at = CURRENT_TIMESTAMP()
            WHERE slug = @slug AND deleted_at IS NULL`,
    params: { slug }, types: { slug: "STRING" },
  });
}

type RawSnap = {
  slug: string;
  run_on: string | { value: string };
  week_start: string | { value: string };
  week_end: string | { value: string };
  report_type: string;
  week_label: string;
  badge: string;
  latest_webinar: string | null;
  context_tag: string | null;
  context_title: string | null;
  context_body: string | null;
  insights_generation_status: string | null;
  insights_generated_at: string | null;
  insights_generation_error: string | null;
  created_at: string;
  updated_at: string | null;
};

function unwrapDate(v: string | { value: string }): string {
  return typeof v === "string" ? v : v.value;
}

function rowToSnapshot(r: RawSnap): Snapshot {
  return {
    slug: r.slug,
    runOn: unwrapDate(r.run_on),
    weekStart: unwrapDate(r.week_start),
    weekEnd: unwrapDate(r.week_end),
    reportType: r.report_type as ReportType,
    weekLabel: r.week_label,
    badge: r.badge,
    latestWebinar: r.latest_webinar,
    contextTag: r.context_tag,
    contextTitle: r.context_title,
    contextBody: r.context_body,
    insightsGenerationStatus: (r.insights_generation_status as InsightsGenStatus | null) ?? "pending",
    insightsGeneratedAt: r.insights_generated_at,
    insightsGenerationError: r.insights_generation_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SNAPSHOT_FIELDS = `slug,
  FORMAT_DATE('%F', run_on) AS run_on,
  FORMAT_DATE('%F', week_start) AS week_start,
  FORMAT_DATE('%F', week_end) AS week_end,
  report_type, week_label, badge, latest_webinar,
  context_tag, context_title, context_body,
  insights_generation_status,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', insights_generated_at, 'UTC') AS insights_generated_at,
  insights_generation_error,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at, 'UTC') AS created_at,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at, 'UTC') AS updated_at`;

export async function listSnapshots(): Promise<Snapshot[]> {
  await ensure();
  const [rows] = await bq().query({
    query: `SELECT ${SNAPSHOT_FIELDS} FROM ${SNAPSHOTS}
            WHERE deleted_at IS NULL
            ORDER BY run_on DESC, slug DESC`,
  });
  return (rows as RawSnap[]).map(rowToSnapshot);
}

export async function getSnapshot(slug: string): Promise<Snapshot | null> {
  await ensure();
  const [rows] = await bq().query({
    query: `SELECT ${SNAPSHOT_FIELDS} FROM ${SNAPSHOTS}
            WHERE slug = @slug AND deleted_at IS NULL LIMIT 1`,
    params: { slug },
    types: { slug: "STRING" },
  });
  const r = (rows as RawSnap[])[0];
  return r ? rowToSnapshot(r) : null;
}

export async function createSnapshot(
  s: Omit<Snapshot, "createdAt" | "updatedAt" | "insightsGenerationStatus" | "insightsGeneratedAt" | "insightsGenerationError">,
): Promise<void> {
  await ensure();
  // New snapshots start 'pending' — the VM cron will pick them up.
  await mergeSnapshot(s, "pending");
}

export async function updateSnapshot(
  slug: string,
  patch: Partial<Omit<Snapshot, "slug" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await ensure();
  const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP()"];
  const params: Record<string, string | null> = { slug };
  const types: Record<string, string> = { slug: "STRING" };
  const map: Record<string, string> = {
    runOn: "run_on", weekStart: "week_start", weekEnd: "week_end",
    reportType: "report_type", weekLabel: "week_label", badge: "badge",
    latestWebinar: "latest_webinar", contextTag: "context_tag",
    contextTitle: "context_title", contextBody: "context_body",
  };
  const dateFields = new Set(["runOn", "weekStart", "weekEnd"]);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const col = map[k];
    if (!col) continue;
    const p = `p_${col}`;
    if (dateFields.has(k)) {
      setClauses.push(`${col} = DATE(@${p})`);
    } else {
      setClauses.push(`${col} = @${p}`);
    }
    params[p] = v as string | null;
    types[p] = "STRING";
  }
  if (setClauses.length === 1) return;
  await bq().query({
    query: `UPDATE ${SNAPSHOTS} SET ${setClauses.join(", ")} WHERE slug = @slug AND deleted_at IS NULL`,
    params, types,
  });
}

export async function deleteSnapshot(slug: string): Promise<void> {
  await ensure();
  await bq().query({
    query: `UPDATE ${SNAPSHOTS} SET deleted_at = CURRENT_TIMESTAMP() WHERE slug = @slug`,
    params: { slug }, types: { slug: "STRING" },
  });
}

// ─── insights ──────────────────────────────────────────────────────────

type RawInsight = {
  id: string; snapshot_slug: string; tone: string; tag: string; title: string;
  body: string; position: number; created_at: string; updated_at: string | null;
};

const INSIGHT_FIELDS = `id, snapshot_slug, tone, tag, title, body, position,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at, 'UTC') AS created_at,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', updated_at, 'UTC') AS updated_at`;

function rowToInsight(r: RawInsight): Insight {
  return {
    id: r.id,
    snapshotSlug: r.snapshot_slug,
    tone: r.tone as Insight["tone"],
    tag: r.tag,
    title: r.title,
    body: r.body,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listInsights(snapshotSlug: string): Promise<Insight[]> {
  await ensure();
  const [rows] = await bq().query({
    query: `SELECT ${INSIGHT_FIELDS} FROM ${INSIGHTS}
            WHERE snapshot_slug = @slug AND deleted_at IS NULL
            ORDER BY position ASC, created_at ASC`,
    params: { slug: snapshotSlug }, types: { slug: "STRING" },
  });
  return (rows as RawInsight[]).map(rowToInsight);
}

export async function createInsight(opts: {
  snapshotSlug: string; tone: string; tag: string; title: string; body: string; position?: number;
}): Promise<Insight> {
  await ensure();
  const id = crypto.randomUUID();
  const position = opts.position ?? 0;
  await bq().query({
    query: `INSERT INTO ${INSIGHTS} (id, snapshot_slug, tone, tag, title, body, position, created_at)
            VALUES (@id, @slug, @tone, @tag, @title, @body, @position, CURRENT_TIMESTAMP())`,
    params: { id, slug: opts.snapshotSlug, tone: opts.tone, tag: opts.tag, title: opts.title, body: opts.body, position },
    types: { id: "STRING", slug: "STRING", tone: "STRING", tag: "STRING", title: "STRING", body: "STRING", position: "INT64" },
  });
  return {
    id, snapshotSlug: opts.snapshotSlug, tone: opts.tone as Insight["tone"],
    tag: opts.tag, title: opts.title, body: opts.body, position,
    createdAt: new Date().toISOString(), updatedAt: null,
  };
}

export async function updateInsight(id: string, patch: { tone?: string; tag?: string; title?: string; body?: string; position?: number }): Promise<void> {
  await ensure();
  const setClauses: string[] = ["updated_at = CURRENT_TIMESTAMP()"];
  const params: Record<string, string | number> = { id };
  const types: Record<string, string> = { id: "STRING" };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    setClauses.push(`${k} = @p_${k}`);
    params[`p_${k}`] = v as string | number;
    types[`p_${k}`] = typeof v === "number" ? "INT64" : "STRING";
  }
  if (setClauses.length === 1) return;
  await bq().query({
    query: `UPDATE ${INSIGHTS} SET ${setClauses.join(", ")} WHERE id = @id AND deleted_at IS NULL`,
    params, types,
  });
}

export async function deleteInsight(id: string): Promise<void> {
  await ensure();
  await bq().query({
    query: `UPDATE ${INSIGHTS} SET deleted_at = CURRENT_TIMESTAMP() WHERE id = @id`,
    params: { id }, types: { id: "STRING" },
  });
}
