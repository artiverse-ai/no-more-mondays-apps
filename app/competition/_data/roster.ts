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

// Procedurally-generated AI-style avatar per closer via DiceBear (free,
// no API key, returns SVG, CDN-cached by the browser). Each closer's
// avatar is deterministic from their name — same person always gets the
// same face, the team-color circle behind acts as the jersey background.
//
// Style "personas" = clean modern cartoon portraits.
// To upgrade to true AI-generated portraits (Midjourney/DALL-E/etc.):
//   1. Generate portrait, save as /public/competition/jerseys/<name>.png
//   2. Change the closer's `imageUrl` below to /competition/jerseys/<name>.png
// The CSS doesn't care about the source — PNG or SVG both work.
const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}`;

// 10 active closers split into 2 balanced teams based on L30D cash.
// Re-balance by editing the `team:` field of any row.
export const ROSTER: CloserProfile[] = [
  // ─── Red Hawks ──────────────────────────────────────────────
  { closerOwner: "Ben",     team: "red", jersey: 10, imageUrl: avatar("Ben-NMM") },
  { closerOwner: "Tyler",   team: "red", jersey:  7, imageUrl: avatar("Tyler-NMM") },
  { closerOwner: "Morgan",  team: "red", jersey:  4, imageUrl: avatar("Morgan-NMM") },
  { closerOwner: "Cecilia", team: "red", jersey:  5, imageUrl: avatar("Cecilia-NMM") },
  { closerOwner: "Grace",   team: "red", jersey:  3, imageUrl: avatar("Grace-NMM") },
  // ─── Blue Wolves ────────────────────────────────────────────
  { closerOwner: "Jordan",  team: "blue", jersey: 11, imageUrl: avatar("Jordan-NMM") },
  { closerOwner: "Destiny", team: "blue", jersey: 21, imageUrl: avatar("Destiny-NMM") },
  { closerOwner: "Johanna", team: "blue", jersey:  8, imageUrl: avatar("Johanna-NMM") },
  { closerOwner: "Luke",    team: "blue", jersey:  1, imageUrl: avatar("Luke-NMM") },
  { closerOwner: "Derek",   team: "blue", jersey:  9, imageUrl: avatar("Derek-NMM") },
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
