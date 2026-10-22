import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { ApiError } from '@web/lib/api'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/**
 * Every route failure lands here, via `defaultErrorComponent` in `main.tsx`.
 * See src/web/README.md.
 *
 * Retrying needs both calls: `reset` clears the router's error state, and
 * `router.invalidate()` re-runs the loaders. Resetting alone re-throws the cached error.
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
