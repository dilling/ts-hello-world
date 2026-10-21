import { listWidgetsQuerySchema, WIDGET_STATUSES } from '@shared/widget'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card'
import { WidgetScoreChart } from '@web/features/widgets/widget-score-chart'
import { WidgetTable } from '@web/features/widgets/widget-table'
import { api, unwrap } from '@web/lib/api'
import { invalidateWidgets, widgetQueries } from '@web/lib/queries'
import { RefreshCw } from 'lucide-react'

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
  const queryClient = useQueryClient()

  const { data: widgets } = useSuspenseQuery(widgetQueries.list(search))

  const refresh = useMutation({
    mutationFn: async () => unwrap(await api.widgets.refresh.$post()),
    onSuccess: () => invalidateWidgets(queryClient),
  })

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

        <Button onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <RefreshCw className={refresh.isPending ? 'animate-spin' : undefined} />
          {refresh.isPending ? 'Refreshing…' : 'Refresh now'}
        </Button>
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
