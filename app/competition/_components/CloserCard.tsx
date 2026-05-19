import type { Achievement, CloserScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

// IMPORTANT: closers see this dashboard. Never render cash amounts —
// only points + deal counts + achievements + rank.

const ACHIEVEMENT_META: Record<Achievement, { icon: string; label: string; tip: string }> = {
  "mvp":       { icon: "👑", label: "MVP",       tip: "Top scorer overall this period" },
  "fuc-king":  { icon: "💎", label: "FUC King",  tip: "Most follow-up closes this period" },
  "hat-trick": { icon: "🎩", label: "Hat Trick", tip: "3+ deals closed in a single day" },
  "streak":    { icon: "🔥", label: "Streak",    tip: "3+ consecutive days with deals" },
};

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function CloserCard({ score }: { score: CloserScore }) {
  const { profile, basePoints, deals, fucDeals, rank, achievements } = score;
  const displayName = profile.displayName ?? profile.closerOwner;
  const initial = displayName.slice(0, 2).toUpperCase();
  const medal = RANK_MEDAL[rank];

  return (
    <div className={styles.closerCard}>
      <div className={styles.rankBadge}>
        {medal ? <span className={styles.rankMedal}>{medal}</span> : <span className={styles.rankNum}>#{rank}</span>}
      </div>
      <div className={styles.jerseyImage}>
        {profile.imageUrl ? (
          <img src={profile.imageUrl} alt={displayName} />
        ) : (
          <span>{initial}</span>
        )}
        <span className={styles.jerseyNumber}>{profile.jersey}</span>
      </div>
      <div className={styles.closerInfo}>
        <div className={styles.closerName}>{displayName}</div>
        <div className={styles.closerSub}>
          {fmtInt(deals)} {deals === 1 ? "deal" : "deals"}
          {fucDeals > 0 && <> · {fmtInt(fucDeals)} FUC 2×</>}
        </div>
        {achievements.length > 0 && (
          <div className={styles.achievementRow}>
            {achievements.map((a) => (
              <span key={a} className={styles.achievementChip} title={ACHIEVEMENT_META[a].tip}>
                <span aria-hidden>{ACHIEVEMENT_META[a].icon}</span>
                {ACHIEVEMENT_META[a].label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className={styles.closerPoints}>{fmtInt(basePoints)}</div>
        <div className={styles.closerPointsLabel}>pts</div>
      </div>
    </div>
  );
}
