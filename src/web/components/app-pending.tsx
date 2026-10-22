import { Loader2 } from 'lucide-react'

/**
 * Shown while a route loader is in flight. Wired up as the router's
 * `defaultPendingComponent` in `main.tsx`, which is what stops a slow first paint from
 * being an empty white page.
 *
 * Deliberately not a skeleton: a generic spinner can't go stale when a page's layout
 * changes. Add a per-route `pendingComponent` if a specific page earns a skeleton.
 */
export function AppPending() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 className="size-4 animate-spin" />
      Loading…
    </div>
  )
}
