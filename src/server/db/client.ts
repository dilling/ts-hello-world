import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

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
