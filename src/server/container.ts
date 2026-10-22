import type { PgBoss } from 'pg-boss'
import { createDatabase, type DatabaseHandle } from './db/client'
import type { Env } from './env'
import { createQueue } from './jobs/queue'
import { createLogger, type Logger } from './lib/logger'
import { createWidgetRepository, type WidgetRepository } from './repositories/widget.repository'
import { createHealthService, type HealthService } from './services/health.service'
import { createWidgetService, type WidgetService } from './services/widget.service'

/** The composition root: env -> db -> repositories -> services. See src/server/README.md. */
export interface Repositories {
  widgets: WidgetRepository
}

export interface Services {
  widgets: WidgetService
  health: HealthService
}

export interface Container {
  env: Env
  logger: Logger
  database: DatabaseHandle
  queue: PgBoss
  repositories: Repositories
  services: Services
  shutdown: () => Promise<void>
}

export function createContainer(env: Env): Container {
  const logger = createLogger(env)
  const database = createDatabase(env.DATABASE_URL)
  const queue = createQueue(env.DATABASE_URL, logger)

  const repositories: Repositories = {
    widgets: createWidgetRepository(database.db),
  }

  const services: Services = {
    widgets: createWidgetService({ widgets: repositories.widgets, logger }),
    health: createHealthService({ database, queue, logger }),
  }

  return {
    env,
    logger,
    database,
    queue,
    repositories,
    services,
    shutdown: async () => {
      await database.close()
    },
  }
}
