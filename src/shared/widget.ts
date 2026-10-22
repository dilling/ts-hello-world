import { z } from 'zod'

/**
 * These schemas are the single source of truth for the Widget DTOs.
 *
 * The server validates requests against them (`@hono/zod-validator`) and the web app
 * imports the inferred types. Change a field here and both sides move together.
 *
 * NOTE: timestamps are ISO strings, not `Date`. Everything crossing the wire is JSON,
 * so the repository converts `Date` -> string at the data-access boundary. If domain
 * types claimed `Date` here, the typed RPC client would promise `Date` and hand you a
 * string at runtime — a genuinely annoying bug to chase at 2am.
 */

export const WIDGET_STATUSES = ['active', 'paused', 'archived'] as const
export const widgetStatusSchema = z.enum(WIDGET_STATUSES)
export type WidgetStatus = z.infer<typeof widgetStatusSchema>

export const widgetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: widgetStatusSchema,
  /** Stand-in for "coverage %" — a 0-100 metric we can chart. */
  score: z.number().int().min(0).max(100),
  lastRefreshedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})
export type Widget = z.infer<typeof widgetSchema>

/**
 * The editable fields, with NO defaults — the base both write schemas derive from.
 *
 * This is also the schema the frontend form validates against (see
 * `src/web/features/widgets/widget-form.tsx`), and it has to be the no-defaults one.
 * A `.default()` makes a field optional on a schema's *input* side, so
 * `createWidgetSchema` describes "what a request body may omit" while a form always
 * holds a concrete value for every control. Handing the form `createWidgetSchema`
 * doesn't typecheck for exactly that reason.
 */
export const widgetFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  status: widgetStatusSchema,
  score: z.number().int().min(0).max(100),
})
export type WidgetFields = z.infer<typeof widgetFieldsSchema>

export const createWidgetSchema = widgetFieldsSchema.extend({
  status: widgetStatusSchema.default('active'),
  score: z.number().int().min(0).max(100).default(0),
})
export type CreateWidgetInput = z.infer<typeof createWidgetSchema>

/**
 * Derived from the no-defaults base, NOT `createWidgetSchema.partial()`. `.partial()`
 * keeps the defaults, so `PATCH { score }` would also write `status: 'active'` and
 * silently un-pause a paused widget.
 */
export const updateWidgetSchema = widgetFieldsSchema.partial()
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>

/**
 * Query params arrive as strings, hence `coerce`. This is the shape that becomes
 * typed search params on the frontend route — the mechanism real filters should use.
 */
export const listWidgetsQuerySchema = z.object({
  status: widgetStatusSchema.optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
})
export type ListWidgetsQuery = z.infer<typeof listWidgetsQuerySchema>
