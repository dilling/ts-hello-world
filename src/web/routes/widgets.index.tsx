import { listWidgetsQuerySchema, WIDGET_STATUSES } from '@shared/widget'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card'
import { WidgetScoreChart } from '@web/features/widgets/widget-score-chart'
import { WidgetTable } from '@web/features/widgets/widget-table'
import { useRefreshWidgets } from '@web/lib/mutations'
import { widgetQueries } from '@web/lib/queries'
import { Plus, RefreshCw } from 'lucide-react'

/**
 * PATTERN: a data-driven route.
 *
 *  - `validateSearch` with a zod schema gives typed, validated URL state. The filter
 *    lives in the URL, so it survives reload and is shareable — this is the mechanism
 *    the real `?team=&since=` filters should use.
 *  - `loader` prefetches via the same queryOptions the component consumes, so
 *    navigation doesn't flash a spinner.
 *  - `useSuspenseQuery` then reads from cache and never returns undefined, which
 *    removes the usual `if (!data) return null` noise.
 */
export const Route = createFileRoute('/widgets/')({
  validateSearch: listWidgetsQuerySchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(widgetQueries.list(deps)),
  component: WidgetsDashboard,
})

function WidgetsDashboard() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: widgets } = useSuspenseQuery(widgetQueries.list(search))

  // The mutation itself lives in `lib/mutations.ts` — invalidation and the success and
  // failure toasts come with it, so the route only decides when to fire it.
  const refresh = useRefreshWidgets()

  const average =
    widgets.length === 0
      ? 0
      : Math.round(widgets.reduce((sum, w) => sum + w.score, 0) / widgets.length)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Widget scores</h1>
          <p className="text-muted-foreground text-sm">
            {widgets.length} widget(s) · {average}% average
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/widgets/new"
            className="hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium"
          >
            <Plus className="size-4" />
            New widget
          </Link>

          <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={refresh.isPending ? 'animate-spin' : undefined} />
            {refresh.isPending ? 'Refreshing…' : 'Refresh now'}
          </Button>
        </div>
      </div>

      {/* Filter state goes into the URL, not useState. */}
      <div className="flex gap-2">
        <Button
          variant={search.status === undefined ? 'default' : 'outline'}
          size="sm"
          onClick={() => void navigate({ search: (prev) => ({ ...prev, status: undefined }) })}
        >
          All
        </Button>
        {WIDGET_STATUSES.map((status) => (
          <Button
            key={status}
            variant={search.status === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => void navigate({ search: (prev) => ({ ...prev, status }) })}
          >
            {status}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score by widget</CardTitle>
          <CardDescription>Stand-in for coverage by repo.</CardDescription>
        </CardHeader>
        <CardContent>
          <WidgetScoreChart widgets={widgets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All widgets</CardTitle>
        </CardHeader>
        <CardContent>
          <WidgetTable widgets={widgets} />
        </CardContent>
      </Card>
    </div>
  )
}
