import { Hono } from 'hono'
import { z } from 'zod'
import { createWidgetSchema, listWidgetsQuerySchema, updateWidgetSchema } from '../../shared/widget'
import { validate } from '../lib/validator'
import type { WidgetService } from '../services/widget.service'

const idParamSchema = z.object({ id: z.uuid() })

/**
 * IMPORTANT: keep these handlers in one unbroken `.get().post()...` chain.
 *
 * The chain is what builds up the type that `hc<AppType>()` reads on the frontend.
 * If you split it into `const r = new Hono(); r.get(...); r.post(...)`, it still works
 * at runtime but the client's types silently collapse and you lose every bit of
 * end-to-end safety — with no error to tell you.
 */
export function createWidgetRoutes(services: { widgets: WidgetService }) {
  return (
    new Hono()
      .get('/', validate('query', listWidgetsQuerySchema), async (c) => {
        const filter = c.req.valid('query')
        const widgets = await services.widgets.list(filter)
        return c.json({ widgets })
      })

      .post('/', validate('json', createWidgetSchema), async (c) => {
        const input = c.req.valid('json')
        const widget = await services.widgets.create(input)
        return c.json({ widget }, 201)
      })

      // Refresh-now, so you can see the job's effect without waiting for the schedule.
      // Calls the exact same service method the scheduled job calls, which is the point
      // of keeping the work in the service rather than in the job handler.
      .post('/refresh', async (c) => {
        const refreshed = await services.widgets.refreshStale({ staleAfterMs: 0 })
        return c.json({ refreshed })
      })

      .get('/:id', validate('param', idParamSchema), async (c) => {
        const { id } = c.req.valid('param')
        const widget = await services.widgets.getById(id)
        return c.json({ widget })
      })

      .patch(
        '/:id',
        validate('param', idParamSchema),
        validate('json', updateWidgetSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          const widget = await services.widgets.update(id, c.req.valid('json'))
          return c.json({ widget })
        },
      )

      .delete('/:id', validate('param', idParamSchema), async (c) => {
        await services.widgets.delete(c.req.valid('param').id)
        return c.body(null, 204)
      })
  )
}
