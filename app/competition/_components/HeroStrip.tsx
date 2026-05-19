import { AutoRefresh } from "./AutoRefresh";
import styles from "./competition.module.css";

/** Persistent hero band at the top of the page — uses the game poster
 *  as a cinematic background (centered on the players' faces), with the
 *  title + live badge overlaid. ~220px on desktop, scales down on mobile. */
export function HeroStrip({ fetchedAt }: { fetchedAt: string }) {
  return (
    <header className={styles.heroStrip}>
      <div className={styles.heroOverlay} aria-hidden="true" />
      <div className={styles.heroContent}>
        <div className={styles.heroEyebrow}>NMM PRESENTS</div>
        <h1 className={styles.heroTitle}>
          THE NO MORE MONDAYS <span className={styles.heroTitleAccent}>GAMES</span>
        </h1>
        <div className={styles.heroSubtitle}>Team Edition · Live Leaderboard</div>
      </div>
      <div className={styles.heroLiveCorner}>
        <AutoRefresh fetchedAt={fetchedAt} intervalSec={30} />
      </div>
    </header>
  );
}
