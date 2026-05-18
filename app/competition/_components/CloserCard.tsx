import type { CloserScore } from "../_lib/scoring";
import { TEAMS } from "../_data/roster";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CloserCard({ score }: { score: CloserScore }) {
  const { profile, basePoints, deals, fucDeals, cashCollected } = score;
  const teamColor = TEAMS[profile.team].color;
  const displayName = profile.displayName ?? profile.closerOwner;
  const initial = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={styles.closerCard}
      style={{ ["--team-color" as string]: teamColor }}
    >
      <div className={styles.jerseyImage}>
        {profile.imageUrl ? (
          <img src={profile.imageUrl} alt={displayName} />
        ) : (
          <span>{initial}</span>
        )}
        <span className={styles.jerseyNumber}>{profile.jersey}</span>
      </div>
      <div>
        <div className={styles.closerName}>{displayName}</div>
        <div className={styles.closerSub}>
          {fmtInt(deals)} {deals === 1 ? "deal" : "deals"}
          {fucDeals > 0 && <> · {fmtInt(fucDeals)} FUC</>}
          {cashCollected > 0 && <> · {fmtUsd(cashCollected)} cash</>}
        </div>
      </div>
      <div>
        <div className={styles.closerPoints}>{fmtInt(basePoints)}</div>
        <div className={styles.closerPointsLabel}>pts</div>
      </div>
    </div>
  );
}
