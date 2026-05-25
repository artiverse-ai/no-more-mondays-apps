import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/** Thin progress bar showing a closer's individual progress to their
 *  personal bonus unlock for the current period. Rendered inside both
 *  Podium rows and CloserCard so every closer can see "I'm X away from
 *  Y dollars" at a glance — not just the team-level bar above. */
export function PersonalBonusBar({
  points,
  threshold,
  bonusUsd,
}: {
  points: number;
  threshold: number;
  bonusUsd: number;
}) {
  const pct = Math.min(100, Math.round((points / threshold) * 100));
  const unlocked = points >= threshold;
  const pointsToGo = Math.max(0, threshold - points);
  return (
    <div className={styles.personalBar} aria-label="Personal bonus progress">
      <div
        className={`${styles.personalBarFill} ${unlocked ? styles.personalBarFillUnlocked : ""}`}
        style={{ width: `${pct}%` }}
      />
      <div className={styles.personalBarLabel}>
        {unlocked
          ? `🎉 ${fmtUsd(bonusUsd)} unlocked`
          : `${fmtInt(pointsToGo)} pts to ${fmtUsd(bonusUsd)}`}
      </div>
    </div>
  );
}
