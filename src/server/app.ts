import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requestId } from 'hono/request-id'
import type { Services } from './container'
import { AppError, toErrorBody } from './lib/errors'
import type { Logger } from './lib/logger'
import { createHealthRoutes } from './routes/health'
import { createWidgetRoutes } from './routes/widgets'

export interface AppDeps {
  services: Services
  logger: Logger
}

/**
 * Takes its dependencies as an argument instead of importing a container, so a test can
 * do `buildApp({ services: { widgets: serviceBackedByInMemoryRepo, ... }, logger })`
 * and exercise real routing with no database. See routes/widgets.test.ts.
 */
export function buildApp({ services, logger }: AppDeps) {
  const api = new Hono()
    .route('/widgets', createWidgetRoutes(services))
    .route('/health', createHealthRoutes(services))

  const app = new Hono()
    .use('*', requestId())
    .route('/api', api)
    // Single error boundary. Domain errors become their declared status; anything else
    // is a 500 whose detail is logged rather than leaked to the client.
    // (Request validation doesn't arrive here — lib/validator.ts responds directly,
    // using the same body shape.)
    .onError((error, c) => {
      if (error instanceof AppError) {
        return c.json(toErrorBody(error), error.status)
      }

      if (error instanceof HTTPException) {
        return error.getResponse()
      }

      logger.error({ err: error, requestId: c.get('requestId') }, 'unhandled error')
      return c.json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500)
    })
    .notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404))

  return app
}

/**
 * The type the frontend's RPC client is built from. Exported from here so there is
 * exactly one source for it — see src/web/lib/api.ts.
 */
export type AppType = ReturnType<typeof buildApp>
