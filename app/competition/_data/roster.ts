// Single-team closer roster (per Ben's decision 2026-05-19):
// "Let's do 1 team. Once the whole team gets to a number it unlocks points."
// Everyone competes individually for personal rank + contributes to the team
// total. Bonus unlocks when the team's combined points cross the threshold.
//
// Jersey numbers + portraits use Marek's AI-generated images
// (assets/Profile Pics.png). When the closer→jersey mapping is confirmed,
// drop individual portraits into /public/competition/jerseys/<name>.png
// and set the imageUrl on each row.

export type CloserProfile = {
  /** Must match int_calls_enriched.closer_owner exactly (case-sensitive). */
  closerOwner: string;
  /** Permanent jersey number — orange badge on the avatar. */
  jersey: number;
  /** Display name override (defaults to closerOwner). */
  displayName?: string;
  /** Path under /public, e.g. "/competition/jerseys/ben.png". Falls back
   *  to initial-circle placeholder when omitted. */
  imageUrl?: string;
};

/** Team metadata — single "No More Mondays" team. Color palette
 *  matches Marek's game poster (deep navy + cinematic orange). */
export const TEAM = {
  name: "No More Mondays",
  short: "NMM",
  primary: "#ff7a1a",       // poster orange — accent color
  primaryDark: "#e25c00",
  primaryGlow: "#ffae66",
  navy: "#0b1d3d",          // poster navy — background
  navyDeep: "#050f20",
  cream: "#f5e9d6",         // text + highlight
} as const;

// Roster — jersey numbers temporary until Marek confirms the
// closer→jersey mapping from the game poster.
export const ROSTER: CloserProfile[] = [
  { closerOwner: "Ben",     jersey: 10, imageUrl: "/competition/jerseys/ben.webp" },
  { closerOwner: "Tyler",   jersey:  7, imageUrl: "/competition/jerseys/tyler.webp" },
  { closerOwner: "Morgan",  jersey:  4, imageUrl: "/competition/jerseys/morgan.webp" },
  { closerOwner: "Cecilia", jersey:  5, imageUrl: "/competition/jerseys/cecilia.webp" },
  { closerOwner: "Grace",   jersey:  3, imageUrl: "/competition/jerseys/grace.webp" },
  { closerOwner: "Jordan",  jersey: 11, imageUrl: "/competition/jerseys/jordan.webp" },
  { closerOwner: "Destiny", jersey: 12, imageUrl: "/competition/jerseys/destiny.webp" },
  { closerOwner: "Johanna", jersey:  8 },
  { closerOwner: "Luke",    jersey:  1 },
  { closerOwner: "Derek",   jersey:  9 },
];

/** Lookup map for fast roster resolution by closer_owner string. */
export const ROSTER_BY_NAME: Map<string, CloserProfile> = new Map(
  ROSTER.map((r) => [r.closerOwner, r]),
);

/** Bonus tiers per period. Two tracks:
 *  - TEAM: combined points to unlock a team bonus pool (everyone shares).
 *  - PER-CLOSER: individual points to unlock a personal bonus (each
 *    closer who clears it gets the $$ regardless of team total).
 *
 *  Points are kept for the in-app loading bars / team_bonus_points field
 *  the existing UI consumes. Dollar values are the actual payout —
 *  closers want to see "$X if I cross this" not just "+N pts".
 *
 *  Defaults below are placeholders. Tune as the league matures. */
export const BONUS_THRESHOLDS = {
  today: {
    teamThreshold:        400,
    teamBonusPts:          40,
    teamBonusUsd:          50,
    perCloserThreshold:   100,
    perCloserBonusUsd:     25,
  },
  week: {
    teamThreshold:       2000,
    teamBonusPts:         200,
    teamBonusUsd:         200,
    perCloserThreshold:   500,
    perCloserBonusUsd:    100,
  },
  month: {
    teamThreshold:       8000,
    teamBonusPts:        1000,
    teamBonusUsd:        1000,
    perCloserThreshold:  2000,
    perCloserBonusUsd:    400,
  },
} as const;

/** Competition launch — nothing closed/booked before this counts on any
 *  period view. The league opens Sunday May 24 2026, 7 AM ET. Shared by
 *  the closer and setter leaderboards.
 *
 *  Two constants because we filter at two grains:
 *   - COMPETITION_START is the ET DATE used to floor period windows
 *     (today/week/month start can't precede the launch day).
 *   - COMPETITION_LAUNCH_TS is the exact instant — used by the setter
 *     side, where `calendly_created_ts` is a UTC TIMESTAMP and we need
 *     to drop bookings made before 7 AM ET on launch day. */
export const COMPETITION_START = "2026-05-24";
export const COMPETITION_LAUNCH_TS = "2026-05-24 11:00:00"; // 7 AM ET = 11:00 UTC
