// Shared skeletons for the admin pages. Rendered both by `loading.tsx`
// (route-segment loading) and by `<Suspense fallback={...}>` boundaries.

export function ClosersSkeleton() {
  return (
    <section className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-24 rounded bg-muted/50" />
        <div className="h-3 w-full max-w-xl rounded bg-muted/30" />
        <div className="h-3 w-2/3 max-w-xl rounded bg-muted/30" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <div className="h-24 rounded-2xl border border-border bg-card" />
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="h-3 w-16 rounded bg-muted/40" />
        </div>
        <SkeletonRows />
      </div>
    </section>
  );
}

export function AccessSkeleton() {
  return (
    <section className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-32 rounded bg-muted/50" />
        <div className="h-3 w-full max-w-xl rounded bg-muted/30" />
        <div className="h-3 w-3/4 max-w-xl rounded bg-muted/30" />
      </div>
      <div className="h-24 rounded-2xl border border-border bg-card" />
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="h-3 w-20 rounded bg-muted/40" />
        </div>
        <SkeletonRows />
      </div>
    </section>
  );
}

function SkeletonStat() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-2 w-16 rounded bg-muted/40" />
      <div className="mt-3 h-7 w-10 rounded bg-muted/50" />
      <div className="mt-2 h-2 w-20 rounded bg-muted/30" />
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center justify-between border-b border-border/60 px-4 py-3 last:border-b-0"
        >
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-muted/40" />
            <div className="h-2 w-48 rounded bg-muted/30" />
          </div>
          <div className="h-6 w-16 rounded-full bg-muted/30" />
        </li>
      ))}
    </ul>
  );
}
