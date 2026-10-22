import { z } from 'zod'

/**
 * Single source of truth for the Widget DTOs: the server validates against these schemas
 * and the web app imports the inferred types.
 *
 * Timestamps are ISO strings, not `Date` — everything here crosses the wire as JSON, and
 * claiming `Date` would have the RPC client promise one and hand you a string at runtime.
 * The repository converts at the data-access boundary.
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

const widgetFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  status: widgetStatusSchema,
  score: z.number().int().min(0).max(100),
})

export const createWidgetSchema = widgetFieldsSchema.extend({
  status: widgetStatusSchema.default('active'),
  score: z.number().int().min(0).max(100).default(0),
})
export type CreateWidgetInput = z.infer<typeof createWidgetSchema>

/**
 * Derived from the no-defaults base, NOT `createWidgetSchema.partial()` — that keeps the
 * defaults, so `PATCH { score }` would also write `status: 'active'` and un-pause a
 * paused widget.
 */
export const updateWidgetSchema = widgetFieldsSchema.partial()
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>

/** Query params arrive as strings, hence `coerce`. Also the frontend's search params. */
export const listWidgetsQuerySchema = z.object({
  status: widgetStatusSchema.optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
})
export type ListWidgetsQuery = z.infer<typeof listWidgetsQuerySchema>
