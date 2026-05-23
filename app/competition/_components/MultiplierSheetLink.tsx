import styles from "./competition.module.css";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Z2kO4mv4e7q-yxjNnZmNAQEr3XBfQJ_QskD4AEQhlUc/edit?gid=1109150682";

/** Persistent banner at the top of both competition pages pointing to
 *  the Google Sheet where bonus-day multipliers live. The actual
 *  "today is 2× points!" hype banner is MultiplierBanner; this one is
 *  always visible so admins know where to add bonus days. */
export function MultiplierSheetLink() {
  return (
    <div className={styles.multiplierSheetLink}>
      <div className={styles.multiplierSheetText}>
        <strong>📊 Bonus days</strong> — Add a row in the sheet to make
        points count <strong>2× / 3×</strong> on a specific date. The
        date is the booking/close date in ET. Closers and setters both
        honour it within ~1 minute, no deploy.
      </div>
      <a
        href={SHEET_URL}
        target="_blank"
        rel="noreferrer"
        className={styles.multiplierSheetButton}
      >
        Open sheet ↗
      </a>
    </div>
  );
}
