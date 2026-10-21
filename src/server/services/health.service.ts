import type { PgBoss } from 'pg-boss'
import type { DatabaseHandle } from '../db/client'
import type { Logger } from '../lib/logger'

export type ComponentStatus = 'ok' | 'error' | 'disabled'

export interface HealthReport {
  status: 'ok' | 'degraded'
  db: ComponentStatus
  queue: ComponentStatus
  uptimeSeconds: number
}

export interface HealthService {
  check(): Promise<HealthReport>
}

export interface HealthServiceDeps {
  database: Pick<DatabaseHandle, 'sql'>
  /** Null when the worker isn't running in this process (e.g. unit tests). */
  queue: PgBoss | null
  logger: Logger
}

export function createHealthService({ database, queue, logger }: HealthServiceDeps): HealthService {
  return {
    async check() {
      const db = await probe(logger, 'db', async () => {
        await database.sql`select 1`
      })

      const queueStatus = queue
        ? await probe(logger, 'queue', async () => {
            // Throws if pg-boss can't reach its schema.
            await queue.getQueues()
          })
        : 'disabled'

      const healthy = db === 'ok' && queueStatus !== 'error'

      return {
        status: healthy ? 'ok' : 'degraded',
        db,
        queue: queueStatus,
        uptimeSeconds: Math.round(process.uptime()),
      } satisfies HealthReport
    },
  }
}

async function probe(
  logger: Logger,
  name: string,
  fn: () => Promise<void>,
): Promise<ComponentStatus> {
  try {
    await fn()
    return 'ok'
  } catch (error) {
    logger.error({ err: error, component: name }, 'health probe failed')
    return 'error'
  }
}
