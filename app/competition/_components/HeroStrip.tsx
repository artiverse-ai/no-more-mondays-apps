import styles from "./competition.module.css";

/** Persistent hero — shows the FULL game poster (uncropped) so the
 *  whole design is visible. Poster has its own baked-in title so no
 *  overlay needed. WebP variant is 9× smaller than the PNG source
 *  (300KB vs 2.7MB) so it paints almost instantly. */
export function HeroStrip() {
  return (
    <header className={styles.heroStrip}>
      <picture>
        <source srcSet="/competition/poster.webp" type="image/webp" />
        <img
          src="/competition/poster.png"
          alt="The No More Mondays Games — Team Edition"
          className={styles.heroPoster}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </header>
  );
}
