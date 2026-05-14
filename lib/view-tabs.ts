// Shared type + parser for the URL-driven view-tab selector. Lives in
// `lib/` (not in the "use client" component module) so server pages can
// import `parseViewTab` without Next 16 throwing the "function on the
// client" runtime error.
//
// Same split-pattern as lib/granularity.ts ↔ components/ui/granularity-picker.tsx.

export type ViewTabOption = { key: string; label: string };

/** Validate a `?view=` param against an allowed option set; fall back to
 *  `fallback` if missing or unknown. */
export function parseViewTab(
  raw: string | string[] | undefined,
  allowed: ViewTabOption[],
  fallback: string,
): string {
  const v = typeof raw === "string" ? raw : "";
  return allowed.some((o) => o.key === v) ? v : fallback;
}
