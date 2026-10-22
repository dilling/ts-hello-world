import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { buildApp } from './app'
import { createContainer } from './container'
import { loadEnv } from './env'
import { startWorker, stopWorker } from './jobs/worker'
import { mountSpa } from './static'

const env = loadEnv()
const container = createContainer(env)
const { logger } = container

const app = buildApp({ services: container.services, logger })

// Production serves the SPA from here too; in dev Vite serves it and proxies /api.
// Statements, not a conditional `.use()` chain — chaining would widen AppType.
const WEB_DIST = './dist/web'
if (env.NODE_ENV === 'production') {
  if (!existsSync(WEB_DIST)) {
    logger.warn('dist/web is missing — run `npm run build` to serve the frontend')
  }
  mountSpa(app, WEB_DIST)
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
