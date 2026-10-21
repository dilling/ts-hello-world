import { PgBoss } from 'pg-boss'
import type { Logger } from '../lib/logger'

/**
 * pg-boss keeps its own tables in a dedicated `pgboss` schema, so it never collides
 * with the app's migrations and `db:generate` stays unaware of it.
 */
export function createQueue(databaseUrl: string, logger: Logger): PgBoss {
  const boss = new PgBoss({
    connectionString: databaseUrl,
    schema: 'pgboss',
  })

  boss.on('error', (error) => {
    logger.error({ err: error }, 'pg-boss error')
  })

  return boss
}
