// Closer roster for the competition. Edit this file to:
//   • Reassign closers between teams
//   • Change jersey numbers
//   • Update display name / image URL once AI-animated jerseys are produced
//
// Images: drop AI-generated PNGs into /public/competition/jerseys/<slug>.png.
// Until then the card falls back to an initial-circle placeholder. The
// imageUrl field should be set to the public path once available.
//
// Team naming: Red Hawks vs Blue Wolves (placeholder — rename freely).

export type Team = "red" | "blue";

export type CloserProfile = {
  /** Must match int_calls_enriched.closer_owner exactly (case-sensitive). */
  closerOwner: string;
  team: Team;
  jersey: number;
  /** Display name on the card. Defaults to closerOwner if omitted. */
  displayName?: string;
  /** Optional path under /public, e.g. "/competition/jerseys/ben.png". */
  imageUrl?: string;
};

export const TEAMS = {
  red:  { name: "Red Hawks",  short: "RED",  color: "#dc2626", accent: "#fecaca" },
  blue: { name: "Blue Wolves", short: "BLU", color: "#2563eb", accent: "#bfdbfe" },
} as const;

// PLACEHOLDERS for v1: each card renders an initial-letter circle in the
// team color. When real AI-generated portraits arrive:
//   1. Save as /public/competition/jerseys/<name>.png  (or .jpg)
//   2. Set imageUrl on the closer's row, e.g.:
//        imageUrl: "/competition/jerseys/ben.png"
//   The card auto-swaps the initials for the portrait.

// 10 active closers split into 2 balanced teams based on L30D cash.
// Re-balance by editing the `team:` field of any row.
export const ROSTER: CloserProfile[] = [
  // ─── Red Hawks ──────────────────────────────────────────────
  { closerOwner: "Ben",     team: "red", jersey: 10 },
  { closerOwner: "Tyler",   team: "red", jersey:  7 },
  { closerOwner: "Morgan",  team: "red", jersey:  4 },
  { closerOwner: "Cecilia", team: "red", jersey:  5 },
  { closerOwner: "Grace",   team: "red", jersey:  3 },
  // ─── Blue Wolves ────────────────────────────────────────────
  { closerOwner: "Jordan",  team: "blue", jersey: 11 },
  { closerOwner: "Destiny", team: "blue", jersey: 21 },
  { closerOwner: "Johanna", team: "blue", jersey:  8 },
  { closerOwner: "Luke",    team: "blue", jersey:  1 },
  { closerOwner: "Derek",   team: "blue", jersey:  9 },
];

/** Lookup map for fast roster resolution by closer_owner string. */
export const ROSTER_BY_NAME: Map<string, CloserProfile> = new Map(
  ROSTER.map((r) => [r.closerOwner, r]),
);

/** Bonus thresholds — when a team's daily/weekly/monthly base points crosses
 *  these, they earn the bonus. Tweak as the league matures. */
export const BONUS_THRESHOLDS = {
  today:   { threshold: 200,  bonus:  20 },   // 200 base pts → +20 team bonus
  week:    { threshold: 1000, bonus: 100 },
  month:   { threshold: 4000, bonus: 500 },
} as const;
