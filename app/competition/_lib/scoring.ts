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
  type CloserProfile,
} from "../_data/roster";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";
const CLOSERS = "`no-more-mondays-analytics.nmm_calendar.closers`";
const EMAIL_EXCLUSION =
  "prospect_email_lc NOT LIKE '%@nomoremondays.io%' " +
  "AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')";

/** Fetch the set of currently-active closer first names from the admin
 *  closers table (email prefix → first name, capitalized). Anyone not in
 *  this set is excluded from the leaderboard. */
async function fetchActiveCloserNames(): Promise<Set<string>> {
  const [rows] = await bq().query({
    query: `
      SELECT INITCAP(REGEXP_EXTRACT(email, r'^([^@]+)@')) AS name
      FROM ${CLOSERS}
      WHERE is_active = TRUE
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
  totalDeals: number;
  totalCash: number;                  // internal only — not rendered
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
};

/** Convert a period string + "now" timestamp to a [start, end] DATE window
 *  in ET-bucketed YYYY-MM-DD form. */
export function periodWindow(period: Period, now: Date = new Date()): { start: string; end: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (period === "today") {
    return { start: iso(today), end: iso(today) };
  }
  if (period === "week") {
    // Sales week = Sun-Sat. dow: 0=Sun..6=Sat
    const dow = today.getUTCDay();
    const sun = new Date(today);
    sun.setUTCDate(today.getUTCDate() - dow);
    const sat = new Date(sun);
    sat.setUTCDate(sun.getUTCDate() + 6);
    return { start: iso(sun), end: iso(sat) };
  }
  // month
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { start: iso(monthStart), end: iso(monthEnd) };
}

/** Points = floor(cash / 10), doubled for FUC. */
export function pointsForDeal(cashCollected: number, closeType: "OCC" | "FUC" | "UNKNOWN"): number {
  const base = cashCollected / 10;
  const multiplier = closeType === "FUC" ? 2 : 1;
  return Math.floor(base * multiplier);
}

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
    AND closer_owner IS NOT NULL
    AND ${EMAIL_EXCLUSION}
  ORDER BY date_closed DESC, cash_collected DESC
`;

/** Fetch raw deals for the window + active-closer set in parallel, then
 *  aggregate into a single TeamScore + ranked CloserScore[]. Inactive
 *  closers (closers.is_active=false) are excluded entirely. */
export async function fetchLeaderboard(period: Period, now: Date = new Date()): Promise<Leaderboard> {
  const { start, end } = periodWindow(period, now);
  const [activeNames, dealRowsRaw] = await Promise.all([
    fetchActiveCloserNames(),
    bq().query({
      query: DEALS_SQL,
      params: { start, end },
      types: { start: "STRING", end: "STRING" },
    }),
  ]);
  const rows = dealRowsRaw[0];

  const deals: Deal[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    closerOwner: String(r.closer_owner ?? ""),
    cashCollected: Number(r.cash_collected ?? 0),
    closeType: (r.close_type === "OCC" || r.close_type === "FUC" ? r.close_type : "UNKNOWN") as Deal["closeType"],
    dateClosed: String(r.date_closed ?? ""),
    prospectEmail: String(r.prospect_email ?? ""),
  }));

  // Filter roster to active closers only (closers.is_active=true)
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
    const pts = pointsForDeal(deal.cashCollected, deal.closeType);
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
  const threshold = BONUS_THRESHOLDS[period].threshold;
  const bonusValue = BONUS_THRESHOLDS[period].bonus;
  const bonusEarned = basePoints >= threshold;
  const team: TeamScore = {
    name: TEAM.name,
    short: TEAM.short,
    basePoints,
    bonusPoints: bonusEarned ? bonusValue : 0,
    totalPoints: basePoints + (bonusEarned ? bonusValue : 0),
    bonusEarned,
    bonusThreshold: threshold,
    totalDeals: closers.reduce((s, c) => s + c.deals, 0),
    totalCash: closers.reduce((s, c) => s + c.cashCollected, 0),
  };

  // Recent activity feed (newest 10 deals)
  const recentActivity = deals
    .map((d) => {
      const profile = ROSTER_BY_NAME.get(d.closerOwner);
      if (!profile) return null;
      return { ...d, profile, points: pointsForDeal(d.cashCollected, d.closeType) };
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
  };
}
