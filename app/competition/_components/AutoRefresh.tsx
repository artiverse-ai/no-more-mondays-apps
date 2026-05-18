"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./competition.module.css";

/** Client component that re-fetches the server data every N seconds via
 *  router.refresh() and shows a "live · Xs ago" pulsing indicator. The
 *  server component re-runs and the page updates seamlessly. */
export function AutoRefresh({ fetchedAt, intervalSec = 30 }: { fetchedAt: string; intervalSec?: number }) {
  const router = useRouter();
  const [ageSec, setAgeSec] = useState(0);

  useEffect(() => {
    const fetchedMs = new Date(fetchedAt).getTime();
    const tick = setInterval(() => {
      const age = Math.floor((Date.now() - fetchedMs) / 1000);
      setAgeSec(age);
      if (age >= intervalSec) router.refresh();
    }, 1000);
    return () => clearInterval(tick);
  }, [fetchedAt, intervalSec, router]);

  return (
    <span className={styles.live} aria-label="Live updating">
      <span className={styles.liveDot} />
      Live · {ageSec}s
    </span>
  );
}
