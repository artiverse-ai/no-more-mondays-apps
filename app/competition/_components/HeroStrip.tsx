import styles from "./competition.module.css";

/** Persistent hero — shows the FULL game poster (uncropped) so the
 *  whole design is visible. Poster has its own baked-in title so no
 *  overlay needed. Motivation chip lives in the page top bar (not
 *  inside the poster) so it doesn't fight the artwork. */
export function HeroStrip() {
  return (
    <header className={styles.heroStrip}>
      <img
        src="/competition/poster.png"
        alt="The No More Mondays Games — Team Edition"
        className={styles.heroPoster}
      />
    </header>
  );
}
