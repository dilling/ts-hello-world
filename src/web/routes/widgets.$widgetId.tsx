import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ConfirmButton } from '@web/components/confirm-button'
import { Badge } from '@web/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { scoreTone } from '@web/features/widgets/score'
import { formatTimestamp } from '@web/lib/format'
import { useDeleteWidget } from '@web/lib/mutations'
import { widgetQueries } from '@web/lib/queries'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'

/** Detail route — typed path params, plus the edit/delete entry points. */
export const Route = createFileRoute('/widgets/$widgetId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(widgetQueries.byId(params.widgetId)),
  component: WidgetDetail,
})

function WidgetDetail() {
  // Typed as string because the filename declares $widgetId — no casting, no undefined.
  const { widgetId } = Route.useParams()
  const navigate = useNavigate()
  const { data: widget } = useSuspenseQuery(widgetQueries.byId(widgetId))
  const deleteWidget = useDeleteWidget()

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/widgets"
        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
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
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Field label="Status" value={widget.status} />
            <Field label="Score" value={`${widget.score}%`} />
            <Field label="Last refreshed" value={formatTimestamp(widget.lastRefreshedAt)} />
            <Field label="Created" value={formatTimestamp(widget.createdAt)} />
          </dl>

          <div className="flex gap-2">
            <Link
              to="/widgets/$widgetId/edit"
              params={{ widgetId }}
              className="hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
            >
              <Pencil className="size-3.5" />
              Edit
            </Link>

            <ConfirmButton
              title={`Delete ${widget.name}?`}
              description="This removes the widget permanently. This cannot be undone."
              confirmLabel="Delete"
              disabled={deleteWidget.isPending}
              onConfirm={() => {
                deleteWidget.mutate(widgetId, {
                  // Navigate only once the delete lands, or the detail query refetches a
                  // row that no longer exists and throws a 404 at the error component.
                  onSuccess: () => void navigate({ to: '/widgets' }),
                })
              }}
            >
              <Trash2 />
              Delete
            </ConfirmButton>
          </div>
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
