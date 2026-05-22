// Setter competition roster. Setters compete INDIVIDUALLY — no team,
// no shared pot (per Marek 2026-05-22). Names must match
// COALESCE(setter_owner, calendly_setter_name) in
// dbt_tuddin.int_calls_enriched exactly.

export type SetterProfile = {
  /** Exact name as it appears in int_calls_enriched. */
  setter: string;
  /** Display name override (defaults to setter). */
  displayName?: string;
};

export const SETTER_ROSTER: SetterProfile[] = [
  { setter: "Hania" },
  { setter: "Swapnil", displayName: "Swap" },
  { setter: "Sal" },
];

/** Points a setter earns per booked call. */
export const POINTS_PER_BOOKING = 100;
