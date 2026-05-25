// Competition scoring engine — pulls deals from int_calls_enriched,
// converts to points, ranks the closers, and aggregates a single
// team total for the bonus unlock.
//
// Scoring rules (per user spec):
//   • $10 cash collected = 1 point  (OCC = One-Call Close)
//   • $10 cash collected = 2 points (FUC = Follow-Up Close)
// Bonus rule: when the team's combined base points cross the period
// threshold (configured in roster.ts → BONUS_THRESHOLDS), every closer
// shares the bonus pot. Single team — no Red/Blue split (Ben's call
// 2026-05-19: "Once the whole team gets to a number it unlocks points").

import { bq } from "@/lib/bq";
import {
  ROSTER,
  ROSTER_BY_NAME,
  TEAM,
  BONUS_THRESHOLDS,
  COMPETITION_START,
  COMPETITION_LAUNCH_TS,
  type CloserProfile,
} from "../_data/roster";
import { fetchPointMultipliers, todayEt } from "./multipliers";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";
// Single source of truth for "who is a competing closer". The
// team_members VIEW already encodes the canonical rule —
// is_active = TRUE AND is_available_to_take_call = TRUE — so the
// competition and the capacity dashboard can never disagree. Querying
// the closers table directly with `is_active = TRUE` alone let through
// closers who are active employees but not taking calls (e.g. Derek),
// which surfaced them on the leaderboard incorrectly.
const TEAM_MEMBERS = "`no-more-mondays-analytics.nmm_calendar.team_members`";
const EMAIL_EXCLUSION =
  "prospect_email_lc NOT LIKE '%@nomoremondays.io%' " +
  "AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')";

/** Fetch the set of competing closer first names from the team_members
 *  view (email prefix → first name, capitalized). Anyone not in this
 *  set — inactive OR not available to take calls — is excluded from
 *  the leaderboard. */
async function fetchActiveCloserNames(): Promise<Set<string>> {
  const [rows] = await bq().query({
    query: `
      SELECT INITCAP(REGEXP_EXTRACT(email, r'^([^@]+)@')) AS name
      FROM ${TEAM_MEMBERS}
    `,
  });
  return new Set((rows as Array<{ name: string }>).map((r) => r.name));
}

export type Period = "today" | "week" | "month";

export type Deal = {
  closerOwner: string;
  cashCollected: number;
  closeType: "OCC" | "FUC" | "UNKNOWN";
  dateClosed: string;            // YYYY-MM-DD
  prospectEmail: string;
};

export type Achievement = "mvp" | "hat-trick" | "fuc-king" | "streak";

export type CloserScore = {
  profile: CloserProfile;
  basePoints: number;
  occPoints: number;
  fucPoints: number;
  deals: number;
  fucDeals: number;
  cashCollected: number;             // internal only — never rendered on /competition
  recentDeals: Deal[];                // last 5 for the activity feed
  /** 1-based rank across the unified team. #1 has the most points. */
  rank: number;
  /** Days closer had at least one deal in the period, sorted ascending. */
  activeDays: string[];
  /** Longest consecutive-day deal streak within the period. */
  longestStreak: number;
  /** Max deals on any single day in the period. */
  bestDay: number;
  achievements: Achievement[];
};

export type TeamScore = {
  name: string;
  short: string;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  bonusEarned: boolean;
  bonusThreshold: number;
  /** Dollar value the team unlocks at bonusThreshold (per period). */
  bonusUsd: number;
  totalDeals: number;
  totalCash: number;                  // internal only — not rendered
};

/** Per-closer bonus config for the active period. Shared across all
 *  closers — the threshold is the same number of points each one must
 *  individually clear to unlock perCloserBonusUsd. UI uses this to
 *  draw the per-closer loading bar + the "$X to unlock" hint. */
export type CloserBonusConfig = {
  perCloserThreshold: number;
  perCloserBonusUsd: number;
};

export type Leaderboard = {
  period: Period;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  team: TeamScore;
  closers: CloserScore[];             // sorted by basePoints DESC
  allDealsCount: number;
  /** Recent activity feed, newest first, max 10. */
  recentActivity: Array<Deal & { profile: CloserProfile; points: number }>;
  /** Point multiplier in effect for today's ET date (1 = normal). */
  todayMultiplier: number;
  /** Per-closer bonus tier for this period — used by Podium + CloserCard
   *  to draw the per-closer progress bar. */
  closerBonus: CloserBonusConfig;
};

/** Get the [year, month, day] of `d` in America/New_York time. Month is
 *  1-12. We split by ET because the business runs on ET sales weeks —
 *  if we used UTC, the dashboard would flip "today" 4-5 hours early
 *  (8 PM ET Sun = midnight UTC Mon would already read as Monday). */
function etYmd(d: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return [get("year"), get("month"), get("day")];
}
const isoYmd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Convert a period string + "now" timestamp to a [start, end] DATE
 *  window in ET-bucketed YYYY-MM-DD form. The window start is floored
 *  at COMPETITION_START — nothing before the league opens ever counts.
 *  If the whole window is pre-launch, start > end and queries return
 *  empty. Note: this is only the DATE bound. Setters additionally floor
 *  at the precise launch instant (7 AM ET) via COMPETITION_LAUNCH_TS so
 *  early-morning Sunday bookings don't slip in. */
export function periodWindow(period: Period, now: Date = new Date()): { start: string; end: string } {
  const [y, m, d] = etYmd(now);
  const today = isoYmd(y, m, d);
  const floor = (s: string) => (s < COMPETITION_START ? COMPETITION_START : s);

  if (period === "today") {
    return { start: floor(today), end: today };
  }
  if (period === "week") {
    // Sales week = Sun-Sat in ET. Anchor at ET noon so DST transitions
    // don't shift the calendar date when we step days.
    const anchor = new Date(Date.UTC(y, m - 1, d, 17)); // 17:00 UTC ≈ noon ET year-round
    const dow = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" })
        .format(anchor)
        .toLowerCase()
        .replace(/sun|mon|tue|wed|thu|fri|sat/, (s) => ({ sun: "0", mon: "1", tue: "2", wed: "3", thu: "4", fri: "5", sat: "6" }[s]!)),
    );
    const sunAnchor = new Date(anchor); sunAnchor.setUTCDate(anchor.getUTCDate() - dow);
    const satAnchor = new Date(sunAnchor); satAnchor.setUTCDate(sunAnchor.getUTCDate() + 6);
    const [sy, sm, sd] = etYmd(sunAnchor);
    const [ey, em, ed] = etYmd(satAnchor);
    return { start: floor(isoYmd(sy, sm, sd)), end: isoYmd(ey, em, ed) };
  }
  // month — ET month, ET-day boundaries
  const monthStartAnchor = new Date(Date.UTC(y, m - 1, 1, 17));
  // day=0 of next month = last day of this month
  const monthEndAnchor = new Date(Date.UTC(y, m, 0, 17));
  const [sy, sm, sd] = etYmd(monthStartAnchor);
  const [ey, em, ed] = etYmd(monthEndAnchor);
  return { start: floor(isoYmd(sy, sm, sd)), end: isoYmd(ey, em, ed) };
}

/** Points = floor(cash / 10), doubled for FUC. */
export function pointsForDeal(cashCollected: number, closeType: "OCC" | "FUC" | "UNKNOWN"): number {
  const base = cashCollected / 10;
  const multiplier = closeType === "FUC" ? 2 : 1;
  return Math.floor(base * multiplier);
}

// Closer leaderboard mirrors the setter rule per Sergio 2026-05-25:
// the call must have been booked AFTER the league opens (7 AM ET Sun
// May 24). So a deal closing today from last-week's pipeline does NOT
// credit the closer — same way it doesn't credit the setter who
// originally booked it. With this in place, closer totals reconcile
// with the sum of setter cash for the same window.
//
// Requires calendly_created_ts IS NOT NULL — manual Airtable rows
// without a Calendly link can't prove a post-launch booking, so they
// don't count. Matches the setter filter exactly.
const DEALS_SQL = `
  SELECT
    closer_owner                                AS closer_owner,
    IFNULL(cash_collected, 0)                   AS cash_collected,
    IFNULL(close_type, 'UNKNOWN')               AS close_type,
    FORMAT_DATE('%F', date_closed)              AS date_closed,
    prospect_email_lc                           AS prospect_email
  FROM ${ENRICHED}
  WHERE is_deal
    AND date_closed BETWEEN DATE(@start) AND DATE(@end)
    AND calendly_created_ts IS NOT NULL
    AND calendly_created_ts >= TIMESTAMP(@launchTs)
    AND closer_owner IS NOT NULL
    AND ${EMAIL_EXCLUSION}
  ORDER BY date_closed DESC, cash_collected DESC
`;

/** Fetch raw deals for the window + active-closer set in parallel, then
 *  aggregate into a single TeamScore + ranked CloserScore[]. Closers not
 *  in the team_members view (inactive, or not available to take calls)
 *  are excluded entirely. */
export async function fetchLeaderboard(period: Period, now: Date = new Date()): Promise<Leaderboard> {
  const { start, end } = periodWindow(period, now);
  const [activeNames, dealRowsRaw, multipliers] = await Promise.all([
    fetchActiveCloserNames(),
    bq().query({
      query: DEALS_SQL,
      params: { start, end, launchTs: COMPETITION_LAUNCH_TS },
      types: { start: "STRING", end: "STRING", launchTs: "STRING" },
    }),
    fetchPointMultipliers(),
  ]);
  const rows = dealRowsRaw[0];
  // Points earned on a special-bonus day count ×N (e.g. double points).
  const multFor = (date: string) => multipliers.get(date) ?? 1;

  const deals: Deal[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    closerOwner: String(r.closer_owner ?? ""),
    cashCollected: Number(r.cash_collected ?? 0),
    closeType: (r.close_type === "OCC" || r.close_type === "FUC" ? r.close_type : "UNKNOWN") as Deal["closeType"],
    dateClosed: String(r.date_closed ?? ""),
    prospectEmail: String(r.prospect_email ?? ""),
  }));

  // Filter roster to competing closers only (in the team_members view)
  const activeRoster = ROSTER.filter((p) => activeNames.has(p.closerOwner));
  const perCloser = new Map<string, CloserScore>();
  const dealsByCloserByDay = new Map<string, Map<string, number>>();
  for (const profile of activeRoster) {
    perCloser.set(profile.closerOwner, {
      profile,
      basePoints: 0,
      occPoints: 0,
      fucPoints: 0,
      deals: 0,
      fucDeals: 0,
      cashCollected: 0,
      recentDeals: [],
      rank: 0,
      activeDays: [],
      longestStreak: 0,
      bestDay: 0,
      achievements: [],
    });
    dealsByCloserByDay.set(profile.closerOwner, new Map());
  }

  for (const deal of deals) {
    const closer = perCloser.get(deal.closerOwner);
    if (!closer) continue;
    const pts = Math.round(
      pointsForDeal(deal.cashCollected, deal.closeType) * multFor(deal.dateClosed),
    );
    closer.basePoints += pts;
    closer.cashCollected += deal.cashCollected;
    closer.deals += 1;
    if (deal.closeType === "FUC") {
      closer.fucPoints += pts;
      closer.fucDeals += 1;
    } else {
      closer.occPoints += pts;
    }
    if (closer.recentDeals.length < 5) {
      closer.recentDeals.push(deal);
    }
    const dayMap = dealsByCloserByDay.get(deal.closerOwner)!;
    dayMap.set(deal.dateClosed, (dayMap.get(deal.dateClosed) ?? 0) + 1);
  }

  // Compute activeDays, longestStreak, bestDay per closer
  for (const score of perCloser.values()) {
    const dayMap = dealsByCloserByDay.get(score.profile.closerOwner)!;
    const days = Array.from(dayMap.keys()).sort();
    score.activeDays = days;
    score.bestDay = Math.max(0, ...Array.from(dayMap.values()));
    let longest = 0, current = 0;
    let prev: Date | null = null;
    for (const d of days) {
      const dt = new Date(d + "T00:00:00Z");
      if (prev && (dt.getTime() - prev.getTime()) === 86400000) {
        current += 1;
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
      prev = dt;
    }
    score.longestStreak = longest;
  }

  // Single ranked list (no team split)
  const closers = Array.from(perCloser.values()).sort((a, b) => b.basePoints - a.basePoints);
  closers.forEach((c, i) => { c.rank = i + 1; });

  // Achievement detection
  const maxFuc = Math.max(0, ...closers.map((c) => c.fucDeals));
  const fucKingCount = maxFuc > 0 ? closers.filter((c) => c.fucDeals === maxFuc).length : 0;
  for (const c of closers) {
    const ach: Achievement[] = [];
    if (c.rank === 1 && c.deals > 0) ach.push("mvp");
    if (maxFuc > 0 && fucKingCount === 1 && c.fucDeals === maxFuc) ach.push("fuc-king");
    if (c.bestDay >= 3) ach.push("hat-trick");
    if (c.longestStreak >= 3) ach.push("streak");
    c.achievements = ach;
  }

  // Single team aggregate
  const basePoints = closers.reduce((s, c) => s + c.basePoints, 0);
  const tiers = BONUS_THRESHOLDS[period];
  const threshold = tiers.teamThreshold;
  const bonusValue = tiers.teamBonusPts;
  const bonusEarned = basePoints >= threshold;
  const team: TeamScore = {
    name: TEAM.name,
    short: TEAM.short,
    basePoints,
    bonusPoints: bonusEarned ? bonusValue : 0,
    totalPoints: basePoints + (bonusEarned ? bonusValue : 0),
    bonusEarned,
    bonusThreshold: threshold,
    bonusUsd: tiers.teamBonusUsd,
    totalDeals: closers.reduce((s, c) => s + c.deals, 0),
    totalCash: closers.reduce((s, c) => s + c.cashCollected, 0),
  };
  const closerBonus: CloserBonusConfig = {
    perCloserThreshold: tiers.perCloserThreshold,
    perCloserBonusUsd: tiers.perCloserBonusUsd,
  };

  // Recent activity feed (newest 10 deals)
  const recentActivity = deals
    .map((d) => {
      const profile = ROSTER_BY_NAME.get(d.closerOwner);
      if (!profile) return null;
      const points = Math.round(
        pointsForDeal(d.cashCollected, d.closeType) * multFor(d.dateClosed),
      );
      return { ...d, profile, points };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .slice(0, 10);

  return {
    period,
    windowStart: start,
    windowEnd: end,
    fetchedAt: new Date().toISOString(),
    team,
    closers,
    allDealsCount: deals.length,
    recentActivity,
    todayMultiplier: multFor(todayEt()),
    closerBonus,
  };
}
