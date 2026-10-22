import { type WidgetFields, widgetFieldsSchema, WIDGET_STATUSES } from '@shared/widget'
import { useForm } from '@tanstack/react-form'
import { Button } from '@web/components/ui/button'
import { Label } from '@web/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select'
import { Input } from '@web/components/ui/input'
import type { ReactNode } from 'react'

/**
 * PATTERN: the form. Copy this file for every new form in the app.
 *
 * Three rules, and they're the whole convention:
 *
 *  1. VALIDATE WITH THE SHARED SCHEMA. `validators.onChange` is handed
 *     `widgetFieldsSchema` from `src/shared/widget.ts` — the same object the server's
 *     write schemas are built from. Zod 4 implements Standard Schema, so TanStack Form
 *     consumes it directly: no adapter package, no second copy of the rules, and a
 *     constraint added on the server can't silently stop being enforced in the UI.
 *     Use the no-defaults base, NOT `createWidgetSchema` — a `.default()` makes a field
 *     optional on the input side and the types won't line up. There's a longer note on
 *     this in `src/shared/widget.ts`.
 *  2. THE FORM DOESN'T KNOW HOW TO SAVE. It takes an `onSubmit` and calls it. The
 *     mutation lives in the route, so this component is testable without a QueryClient
 *     and reusable for both create and edit.
 *  3. ONE `<Field>` WRAPPER renders label + control + error. Don't hand-roll error
 *     markup per field; a field with nowhere to put its message is how invalid forms end
 *     up failing silently on submit.
 *
 * `defaultValues` is typed as `WidgetFields`, so `status` and `score` are required here
 * even though the API defaults them — the form always has a concrete value for every
 * control, which is what keeps the inputs from going uncontrolled.
 */
export interface WidgetFormProps {
  defaultValues: WidgetFields
  onSubmit: (value: WidgetFields) => Promise<unknown>
  /** Create and edit differ by this much. */
  submitLabel: string
  onCancel: () => void
}

export function WidgetForm({ defaultValues, onSubmit, submitLabel, onCancel }: WidgetFormProps) {
  const form = useForm({
    defaultValues,
    validators: { onChange: widgetFieldsSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form
      noValidate
      className="flex max-w-lg flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        // `handleSubmit` returns a promise; the repo lints for unhandled ones.
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Field label="Name" htmlFor={field.name} errors={field.state.meta.errors}>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              aria-invalid={field.state.meta.errors.length > 0}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="auth-service"
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="status">
        {(field) => (
          <Field label="Status" htmlFor={field.name} errors={field.state.meta.errors}>
            {/* Radix Select is not an <input>: it reports through onValueChange, and the
                trigger is a button, so there is no event.target.value to read. */}
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value as WidgetFields['status'])}
            >
              <SelectTrigger id={field.name} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDGET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </form.Field>

      <form.Field name="score">
        {(field) => (
          <Field
            label="Score"
            htmlFor={field.name}
            errors={field.state.meta.errors}
            hint="0–100. Stands in for coverage %."
          >
            <Input
              id={field.name}
              name={field.name}
              type="number"
              inputMode="numeric"
              value={field.state.value}
              aria-invalid={field.state.meta.errors.length > 0}
              onBlur={field.handleBlur}
              // A number input still yields a string, and the schema wants an int —
              // so coerce here rather than letting zod reject the string.
              onChange={(event) => field.handleChange(event.target.valueAsNumber || 0)}
            />
          </Field>
        )}
      </form.Field>

      {/* `Subscribe` re-renders only this subtree as form state changes, instead of the
          whole form on every keystroke. */}
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex gap-2">
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}

/**
 * Label + control + validation message. `errors` comes straight off
 * `field.state.meta.errors`, whose entries are Standard Schema issues (objects with a
 * `message`) rather than plain strings — hence the narrowing below.
 */
function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  errors: readonly unknown[]
  hint?: string
  children: ReactNode
}) {
  const message = errors.length > 0 ? toMessage(errors[0]) : undefined

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {message ? (
        <p role="alert" className="text-destructive text-xs">
          {message}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}

function toMessage(issue: unknown): string {
  if (typeof issue === 'string') return issue
  if (issue && typeof issue === 'object' && 'message' in issue) {
    return String((issue as { message: unknown }).message)
  }
  return 'Invalid value'
}
