import { Loader2 } from 'lucide-react'

/**
 * Shown while a route loader is in flight, via `defaultPendingComponent` in `main.tsx`.
 * A spinner rather than a skeleton, so it can't go stale as layouts change; add a
 * per-route `pendingComponent` where a page earns one.
 */
export function AppPending() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading…
    </div>
  )
}
