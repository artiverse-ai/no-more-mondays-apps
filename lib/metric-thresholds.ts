// Traffic-light thresholds per Shahriar's spec (May 17, 2026).
// Used by Weekly Report cards + Tab 2 comparison rows to color metric
// values green / orange / red based on band membership.
//
// Each entry defines the metric's polarity (higher_better / lower_better)
// and the two boundary values that split the three bands. Values exactly
// on a boundary count toward the better band.

export type TrafficLight = "green" | "orange" | "red" | "neutral";

export type Threshold = {
  /** Whether higher numbers are better (ROAS, show rate) or worse (cost). */
  polarity: "higher_better" | "lower_better";
  /** Boundary between green and orange. */
  goodToOk: number;
  /** Boundary between orange and red. */
  okToBad: number;
  /** Human-readable label used in tooltips / SOPs. */
  spec: string;
};

export const THRESHOLDS = {
  // ──────────────────────────────────────────────────────────────────
  // ROAS — ratio (already in × units, so 3.0 = 3×). Higher better.
  // ──────────────────────────────────────────────────────────────────
  roas: {
    polarity: "higher_better" as const,
    goodToOk: 3,
    okToBad: 2,
    spec: "≥3× green · 2–3× orange · <2× red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Cost per registrant (paid-ad only, NOT blended). Lower better.
  // ──────────────────────────────────────────────────────────────────
  costPerRegistrant: {
    polarity: "lower_better" as const,
    goodToOk: 7,
    okToBad: 10,
    spec: "≤$7 green · $7–10 orange · >$10 red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Landing page opt-in rate. Stored as a fraction (0.20 = 20%).
  // Higher better.
  // ──────────────────────────────────────────────────────────────────
  lpOptInRate: {
    polarity: "higher_better" as const,
    goodToOk: 0.20,
    okToBad: 0.175,
    spec: "≥20% green · 17.5–20% orange · <17.5% red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Average email open rate. Higher better.
  // ──────────────────────────────────────────────────────────────────
  emailOpenRate: {
    polarity: "higher_better" as const,
    goodToOk: 0.30,
    okToBad: 0.25,
    spec: "≥30% green · 25–30% orange · <25% red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Webinar show-up rate (attendees / registrants). Higher better.
  // ──────────────────────────────────────────────────────────────────
  webinarShowUpRate: {
    polarity: "higher_better" as const,
    goodToOk: 0.25,
    okToBad: 0.20,
    spec: "≥25% green · 20–25% orange · <20% red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Attendee retention rate (stayed >= pitched threshold / unique
  // attendees). Higher better.
  // ──────────────────────────────────────────────────────────────────
  attendeeRetention: {
    polarity: "higher_better" as const,
    goodToOk: 0.75,
    okToBad: 0.65,
    spec: "≥75% green · 65–75% orange · <65% red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Pitch-to-book ratio (booked calls / attendees live for >=30 min).
  // Higher better.
  // ──────────────────────────────────────────────────────────────────
  pitchToBookRatio: {
    polarity: "higher_better" as const,
    goodToOk: 0.35,
    okToBad: 0.30,
    spec: "≥35% green · 30–35% orange · <30% red",
  },

  // ──────────────────────────────────────────────────────────────────
  // Cost per booked call. Lower better.
  // ──────────────────────────────────────────────────────────────────
  costPerBookedCall: {
    polarity: "lower_better" as const,
    goodToOk: 100,
    okToBad: 150,
    spec: "≤$100 green · $100–150 orange · >$150 red",
  },
} satisfies Record<string, Threshold>;

export type ThresholdKey = keyof typeof THRESHOLDS;

/**
 * Returns the traffic-light bucket for a value given a threshold key.
 * Returns "neutral" when value is null/undefined/NaN.
 */
export function getTrafficLight(value: number | null | undefined, key: ThresholdKey): TrafficLight {
  if (value == null || !Number.isFinite(value)) return "neutral";
  const t = THRESHOLDS[key];
  if (t.polarity === "higher_better") {
    if (value >= t.goodToOk) return "green";
    if (value >= t.okToBad) return "orange";
    return "red";
  }
  // lower_better
  if (value <= t.goodToOk) return "green";
  if (value <= t.okToBad) return "orange";
  return "red";
}

/**
 * Tailwind text color for each traffic-light bucket.
 * Neutral falls back to the default foreground (no class added).
 */
export function trafficLightTextClass(light: TrafficLight): string {
  switch (light) {
    case "green": return "text-emerald-600";
    case "orange": return "text-amber-600";
    case "red": return "text-rose-600";
    case "neutral": return "";
  }
}
