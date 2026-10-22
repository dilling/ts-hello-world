import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card'
import { WidgetForm } from '@web/features/widgets/widget-form'
import { useCreateWidget } from '@web/lib/mutations'

/** Create route. No loader — there's nothing to fetch. */
export const Route = createFileRoute('/widgets/new')({
  component: NewWidget,
})

function NewWidget() {
  const navigate = useNavigate()
  const createWidget = useCreateWidget()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New widget</CardTitle>
        <CardDescription>Validated against the same zod schema as the API.</CardDescription>
      </CardHeader>
      <CardContent>
        <WidgetForm
          defaultValues={{ name: '', status: 'active', score: 0 }}
          submitLabel="Create widget"
          onCancel={() => void navigate({ to: '/widgets' })}
          onSubmit={async (value) => {
            const widget = await createWidget.mutateAsync(value)
            // mutateAsync rejects on failure, so this only runs on success.
            await navigate({ to: '/widgets/$widgetId', params: { widgetId: widget.id } })
          }}
        />
      </CardContent>
    </Card>
  )
}
