import type { Achievement, CloserBonusConfig, CloserScore } from "../_lib/scoring";
import { PersonalBonusBar } from "./PersonalBonusBar";
import styles from "./competition.module.css";

const fmt = (n: number) => Math.round(n).toLocaleString();

const RANK_META: Array<{ medal: string; cls: keyof typeof styles }> = [
  { medal: "🥇", cls: "podiumGold" as const },
  { medal: "🥈", cls: "podiumSilver" as const },
  { medal: "🥉", cls: "podiumBronze" as const },
];

const ACHIEVEMENT_META: Record<Achievement, { icon: string; label: string; tip: string }> = {
  "mvp":       { icon: "👑", label: "MVP",       tip: "Top scorer overall this period" },
  "fuc-king":  { icon: "💎", label: "FUC King",  tip: "Most follow-up closes this period" },
  "hat-trick": { icon: "🎩", label: "Hat Trick", tip: "3+ deals closed in a single day" },
  "streak":    { icon: "🔥", label: "Streak",    tip: "3+ consecutive days with deals" },
};

/** Top-3 podium that replaces the single MVP card. Gold #1 gets a
 *  crown wobble + glow pulse; silver/bronze get softer treatments.
 *  Each row staggers in on load. Hidden if nobody has scored yet. */
export function Podium({ closers, closerBonus }: { closers: CloserScore[]; closerBonus: CloserBonusConfig }) {
  const top3 = closers.slice(0, 3).filter((c) => c.basePoints > 0);
  if (top3.length === 0) return null;

  return (
    <section className={styles.podium}>
      <div className={styles.podiumHeader}>🏆 The Podium</div>
      <div className={styles.podiumRows}>
        {top3.map((c, i) => {
          const meta = RANK_META[i];
          const displayName = c.profile.displayName ?? c.profile.closerOwner;
          const initial = displayName.slice(0, 2).toUpperCase();
          return (
            <div
              key={c.profile.closerOwner}
              className={`${styles.podiumRow} ${styles[meta.cls]}`}
            >
              <span className={styles.podiumMedal} aria-hidden="true">{meta.medal}</span>
              <div className={styles.podiumAvatar}>
                {c.profile.imageUrl ? (
                  <img src={c.profile.imageUrl} alt={displayName} />
                ) : (
                  <span>{initial}</span>
                )}
                <span className={styles.podiumJersey}>{c.profile.jersey}</span>
              </div>
              <div className={styles.podiumInfo}>
                <div className={styles.podiumName}>{displayName}</div>
                <div className={styles.podiumSub}>
                  {c.deals} deal{c.deals !== 1 ? "s" : ""}
                  {c.fucDeals > 0 ? ` · ${c.fucDeals} FUC` : ""}
                </div>
                {c.achievements.length > 0 && (
                  <div className={styles.podiumAchievements}>
                    {c.achievements.map((a) => (
                      <span
                        key={a}
                        className={styles.podiumChip}
                        title={ACHIEVEMENT_META[a].tip}
                      >
                        <span aria-hidden>{ACHIEVEMENT_META[a].icon}</span>
                        {ACHIEVEMENT_META[a].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.podiumPoints}>
                <div className={styles.podiumPointsVal}>{fmt(c.basePoints)}</div>
                <div className={styles.podiumPointsLbl}>PTS</div>
              </div>
              <div className={styles.podiumBar}>
                <PersonalBonusBar
                  points={c.basePoints}
                  threshold={closerBonus.perCloserThreshold}
                  bonusUsd={closerBonus.perCloserBonusUsd}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
