import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { ApiError } from '@web/lib/api'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/**
 * PATTERN: every route failure lands here.
 *
 * Routes fetch with `useSuspenseQuery`, which *throws* on error by design. Without a
 * route-level error component that throw unmounts the page and TanStack falls back to
 * its own bare renderer — which looks like the app silently died. This is wired up as
 * the router's `defaultErrorComponent` in `main.tsx`, so a new route gets it for free.
 *
 * `reset` clears the router's error state; `router.invalidate()` then re-runs the
 * loaders, which re-fetches the failed query. Both are needed — resetting without
 * invalidating just re-throws the cached error.
 */
export function AppError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <TriangleAlert className="size-4" />
          {headline(error)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground text-sm">{detail(error)}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          <RotateCcw />
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}

/** `unwrap()` throws `ApiError`, so the status is available for a useful heading. */
function headline(error: unknown): string {
  if (error instanceof ApiError) return `Request failed (${error.status})`
  return 'Something went wrong'
}

function detail(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'No further detail was reported.'
}
