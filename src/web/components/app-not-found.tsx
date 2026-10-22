import { Link } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'

/**
 * Shown for an unmatched URL, and for anything that throws `notFound()` from a loader.
 * Wired up as the router's `defaultNotFoundComponent` in `main.tsx`.
 */
export function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <FileQuestion className="text-muted-foreground size-8" />
      <div>
        <p className="font-semibold">Page not found</p>
        <p className="text-muted-foreground text-sm">
          That URL doesn’t match any route in this app.
        </p>
      </div>
      <Link
        to="/widgets"
        className="hover:bg-muted inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
