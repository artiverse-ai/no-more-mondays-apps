import styles from "./competition.module.css";

const WORD: Record<number, string> = { 2: "DOUBLE", 3: "TRIPLE" };

/** Loud banner shown when today is a special-bonus day — points earned
 *  today count ×N. Renders nothing on a normal (1×) day. */
export function MultiplierBanner({ multiplier }: { multiplier: number }) {
  if (multiplier <= 1) return null;
  const word = WORD[multiplier] ?? `${multiplier}×`;
  return (
    <div className={styles.multiplierBanner} role="status">
      ⚡ {word} POINTS TODAY ⚡
      <span className={styles.multiplierBannerSub}>
        Every point you score today counts {multiplier}×
      </span>
    </div>
  );
}
