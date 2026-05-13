// Plain types + constants for the GranularityPicker. Kept in a server-safe
// (non-"use client") module so server pages can import the option arrays
// and the parser without crossing the RSC boundary.

export type Granularity = "day" | "webinar" | "week" | "month" | "year";

export type GranularityOption = { key: Granularity; label: string };

/** Default option set for date-axis dashboards (CEO / Sales / Setter). */
export const GRANS_TIME: GranularityOption[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** Default option set for the per-webinar dashboard. */
export const GRANS_WEBINAR: GranularityOption[] = [
  { key: "webinar", label: "Webinar" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** Validate `?gran=` against an allowed set; fall back if invalid. */
export function parseGranularity(
  raw: string | string[] | undefined,
  allowed: GranularityOption[],
  fallback: Granularity,
): Granularity {
  const v = typeof raw === "string" ? raw : "";
  return allowed.some((o) => o.key === v) ? (v as Granularity) : fallback;
}
