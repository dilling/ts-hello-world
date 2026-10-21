import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { scoreTone } from '@web/features/widgets/score'
import { widgetQueries } from '@web/lib/queries'
import { ArrowLeft } from 'lucide-react'

/** Detail route — exists mainly to demonstrate typed path params end to end. */
export const Route = createFileRoute('/widgets/$widgetId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(widgetQueries.byId(params.widgetId)),
  component: WidgetDetail,
})

function WidgetDetail() {
  // Typed as string because the filename declares $widgetId — no casting, no undefined.
  const { widgetId } = Route.useParams()
  const { data: widget } = useSuspenseQuery(widgetQueries.byId(widgetId))

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/widgets"
        className="text-muted-foreground flex items-center gap-2 text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {widget.name}
            <Badge variant={scoreTone(widget.score)}>{widget.score}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Field label="Status" value={widget.status} />
            <Field label="Score" value={`${widget.score}%`} />
            <Field label="Last refreshed" value={formatTimestamp(widget.lastRefreshedAt)} />
            <Field label="Created" value={formatTimestamp(widget.createdAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleString()
}
