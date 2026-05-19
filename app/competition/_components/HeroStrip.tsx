import styles from "./competition.module.css";

const MOTIVATION = "EVERY CALL COUNTS";

/** Persistent hero — shows the FULL game poster (uncropped) so the
 *  whole design is visible. Poster has its own baked-in title so no
 *  overlay needed. A motivational chip floats in the top-right to
 *  keep closers pumped while they're checking the board. */
export function HeroStrip() {
  return (
    <header className={styles.heroStrip}>
      <img
        src="/competition/poster.png"
        alt="The No More Mondays Games — Team Edition"
        className={styles.heroPoster}
      />
      <div className={styles.heroMotivation} aria-hidden="true">
        <span className={styles.heroMotivationDot} />
        {MOTIVATION}
      </div>
    </header>
  );
}
