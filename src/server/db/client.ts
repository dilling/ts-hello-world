import type { PgDatabase } from 'drizzle-orm/pg-core'
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Deliberately `PgDatabase` rather than `PostgresJsDatabase`, so a transaction handle
 * satisfies it too. That lets a repository be constructed against either the pool or an
 * open transaction — which is what tests use to roll back, and what a service would use
 * to span several repositories in one transaction.
 */
export type Database = PgDatabase<PostgresJsQueryResultHKT, typeof schema>

export interface DatabaseHandle {
  db: Database
  /** The raw postgres.js client — needed for health checks and shutdown. */
  sql: postgres.Sql
  close: () => Promise<void>
}

export function createDatabase(
  url: string,
  options: postgres.Options<Record<string, never>> = {},
): DatabaseHandle {
  const sql = postgres(url, {
    max: 10,
    onnotice: () => {},
    ...options,
  })

  return {
    db: drizzle(sql, { schema }),
    sql,
    close: () => sql.end({ timeout: 5 }),
  }
}
