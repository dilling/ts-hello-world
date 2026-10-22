import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card'
import { WidgetForm } from '@web/features/widgets/widget-form'
import { useUpdateWidget } from '@web/lib/mutations'
import { widgetQueries } from '@web/lib/queries'

/**
 * Edit route — the same `WidgetForm`, pointed at PATCH. The loader reuses the detail
 * query, so arriving from the detail page costs no extra request.
 */
export const Route = createFileRoute('/widgets/$widgetId/edit')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(widgetQueries.byId(params.widgetId)),
  component: EditWidget,
})

function EditWidget() {
  const { widgetId } = Route.useParams()
  const navigate = useNavigate()
  const { data: widget } = useSuspenseQuery(widgetQueries.byId(widgetId))
  const updateWidget = useUpdateWidget()

  const backToDetail = () => navigate({ to: '/widgets/$widgetId', params: { widgetId } })

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Edit {widget.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <WidgetForm
          // Only the editable fields — `id`, timestamps and `lastRefreshedAt` are the
          // server's to set, which is exactly what `updateWidgetSchema` allows.
          defaultValues={{ name: widget.name, status: widget.status, score: widget.score }}
          submitLabel="Save changes"
          onCancel={() => void backToDetail()}
          onSubmit={async (value) => {
            await updateWidget.mutateAsync({ id: widgetId, patch: value })
            await backToDetail()
          }}
        />
      </CardContent>
    </Card>
  )
}
