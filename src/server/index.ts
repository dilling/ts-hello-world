import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { buildApp } from './app'
import { createContainer } from './container'
import { loadEnv } from './env'
import { startWorker, stopWorker } from './jobs/worker'

const env = loadEnv()
const container = createContainer(env)
const { logger } = container

const app = buildApp({ services: container.services, logger })

/**
 * In production the server also serves the built SPA, so there's one artifact and one
 * port. In dev, Vite serves the frontend on :5173 and proxies /api here instead.
 *
 * These are statements rather than part of a `.use()` chain on purpose — chaining them
 * conditionally would widen the inferred type that AppType (and the RPC client) rely on.
 */
const WEB_DIST = './dist/web'
if (env.NODE_ENV === 'production') {
  if (!existsSync(WEB_DIST)) {
    logger.warn('dist/web is missing — run `npm run build` to serve the frontend')
  }
  app.use('/assets/*', serveStatic({ root: WEB_DIST }))
  // SPA fallback: any non-/api path that isn't a real file gets index.html, so deep
  // links like /widgets/<id> resolve to the client router.
  app.get('*', serveStatic({ root: WEB_DIST, path: 'index.html' }))
}

await startWorker({ boss: container.queue, services: container.services, logger })

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port, env: env.NODE_ENV }, 'server listening')
})

let shuttingDown = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutting down')

    void (async () => {
      // Order matters: stop accepting work, drain in-flight jobs, then close the pool.
      server.close()
      await stopWorker(container.queue, logger)
      await container.shutdown()
      process.exit(0)
    })()
  })
}
