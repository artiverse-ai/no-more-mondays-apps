import { AutoRefresh } from "./AutoRefresh";
import styles from "./competition.module.css";

/** Persistent hero at the top of the page — shows the FULL game poster
 *  (not a cropped band) so the whole design is visible. Poster has its
 *  own baked-in title ("THE NO MORE MONDAYS GAMES") so no overlay
 *  needed. Live badge floats in the top-right corner. */
export function HeroStrip({ fetchedAt }: { fetchedAt: string }) {
  return (
    <header className={styles.heroStrip}>
      <img
        src="/competition/poster.png"
        alt="The No More Mondays Games — Team Edition"
        className={styles.heroPoster}
      />
      <div className={styles.heroLiveCorner}>
        <AutoRefresh fetchedAt={fetchedAt} intervalSec={30} />
      </div>
    </header>
  );
}
