// Setter competition roster. Setters compete INDIVIDUALLY — no team,
// no shared pot (per Marek 2026-05-22). Names must match
// COALESCE(setter_owner, calendly_setter_name) in
// dbt_tuddin.int_calls_enriched exactly.
//
// Scoring (per Sergio 2026-05-24): setters earn points from CASH
// COLLECTED on the calls they booked — same $10 = 1 pt formula as
// closers, but tallied on the setter's bookings. See _lib/setter-scoring.ts.

export type SetterProfile = {
  /** Exact name as it appears in int_calls_enriched. */
  setter: string;
  /** Display name override (defaults to setter). */
  displayName?: string;
  /** Path under /public, e.g. "/competition/jerseys/swap.webp". Falls
   *  back to initial-circle placeholder when omitted. */
  imageUrl?: string;
};

export const SETTER_ROSTER: SetterProfile[] = [
  { setter: "Hania",   imageUrl: "/competition/jerseys/hania.webp" },
  { setter: "Swapnil", displayName: "Swap", imageUrl: "/competition/jerseys/swap.webp" },
  { setter: "Sal",     imageUrl: "/competition/jerseys/sal.webp" },
];
