"use client";

import { useEffect, useState } from "react";
import type { Period } from "../_lib/scoring";
import styles from "./competition.module.css";

/** Live countdown to end of the period. Updates every second client-side.
 *  Period boundaries:
 *    today: ends at 23:59:59.999 local browser time
 *    week:  ends Saturday 23:59:59 (sales week Sun-Sat)
 *    month: ends last day of month 23:59:59 */
export function Countdown({ period }: { period: Period }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemainingMs(periodEndsInMs(period));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [period]);

  if (remainingMs == null || remainingMs <= 0) return null;
  return (
    <span className={styles.countdown}>
      ⏱ {formatRemaining(remainingMs)} left in {period === "month" ? "month" : period === "week" ? "week" : "today"}
    </span>
  );
}

function periodEndsInMs(period: Period): number {
  const now = new Date();
  const end = new Date(now);
  if (period === "today") {
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    // Saturday 23:59:59 of the current sales week (Sun-Sat). dow: 0=Sun..6=Sat
    const dow = now.getDay();
    const daysToSat = 6 - dow;
    end.setDate(now.getDate() + daysToSat);
    end.setHours(23, 59, 59, 999);
  } else {
    // Last day of current month, 23:59:59
    end.setMonth(now.getMonth() + 1, 0);  // setMonth(m+1, 0) = last day of month m
    end.setHours(23, 59, 59, 999);
  }
  return end.getTime() - now.getTime();
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
