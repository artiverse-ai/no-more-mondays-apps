/**
 * Merge overlapping intervals and return total wall-clock minutes.
 *
 * Why: an all-day OOO event combined with a meeting inside it would count
 * twice if you just sum (end - start). Real "busy time" is the union.
 */
export function mergedBusyMinutes(
  intervals: Array<{ start_time: string; end_time: string }>
): number {
  if (intervals.length === 0) return 0;
  const ranges = intervals
    .map((i) => [
      new Date(i.start_time).getTime(),
      new Date(i.end_time).getTime(),
    ])
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let curStart = ranges[0][0];
  let curEnd = ranges[0][1];
  for (let i = 1; i < ranges.length; i++) {
    const [s, e] = ranges[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return Math.round(total / 60_000);
}
