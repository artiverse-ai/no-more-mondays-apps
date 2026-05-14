"use client";

// Global pending-state context for the top-of-page NavProgress bar.
//
// Why this exists: the original `<NavProgress>` only fired on raw `<a>`
// clicks (document-level click interceptor). That misses every
// programmatic `router.push()` triggered by a filter chip, a tab click,
// the date-range picker — i.e. exactly the cases where the user is
// waiting on a BigQuery roundtrip. So filter components opt in by
// calling `useReportTransition(isPending)` from inside their
// `useTransition()`, and NavProgress watches the aggregate counter.
//
// API:
//   <NavProgressProvider>…</NavProgressProvider>          // root layout
//   useGlobalPending()        → boolean (counter > 0)     // NavProgress reads
//   useReportTransition(pending)                          // filter components emit

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Ctx = {
  pending: boolean;
  /** Mark one transition as starting. Returns the matching `stop()` fn. */
  start: () => () => void;
};

const NavProgressContext = createContext<Ctx | null>(null);

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  // Counter rather than boolean so concurrent transitions (e.g. two
  // filter components both pushing in the same paint) don't fight.
  const [count, setCount] = useState(0);

  const start = useCallback(() => {
    setCount((c) => c + 1);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      setCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({ pending: count > 0, start }),
    [count, start],
  );

  return (
    <NavProgressContext.Provider value={value}>
      {children}
    </NavProgressContext.Provider>
  );
}

/** Returns `true` while any tracked `router.push()` transition is in
 *  flight. Used by `<NavProgress>` to drive the bar. Safe outside the
 *  provider (returns `false`). */
export function useGlobalPending(): boolean {
  return useContext(NavProgressContext)?.pending ?? false;
}

/** Filter-component hook: pass `isPending` from your `useTransition()`.
 *  This auto-bumps the global counter for the duration of the
 *  transition. Safe outside the provider (no-op). */
export function useReportTransition(isPending: boolean): void {
  const ctx = useContext(NavProgressContext);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ctx) return;
    if (isPending && !stopRef.current) {
      stopRef.current = ctx.start();
    } else if (!isPending && stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  }, [ctx, isPending]);

  // Safety: release the slot on unmount.
  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, []);
}
