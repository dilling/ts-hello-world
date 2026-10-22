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

/** Deps are an argument, not an imported container, so tests can pass fakes. */
export function buildApp({ services, logger }: AppDeps) {
  const api = new Hono()
    .route('/widgets', createWidgetRoutes(services))
    .route('/health', createHealthRoutes(services))

  const app = new Hono()
    .use('*', requestId())
    .route('/api', api)
    // The single error boundary. Request validation doesn't reach it — lib/validator.ts
    // responds directly, with the same body shape.
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

/** The one source for the frontend's RPC client type. See src/web/lib/api.ts. */
export type AppType = ReturnType<typeof buildApp>
