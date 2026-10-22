import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { createDatabase, type DatabaseHandle } from '../../src/server/db/client'
import { MAINTENANCE_DB, TEMPLATE_DB, withDatabase, workerDatabase } from './names'

/**
 * Each Vitest worker gets its own database, cloned from the template global-setup.ts
 * built: `CREATE DATABASE app_test_worker_1 TEMPLATE app_test_template`. Postgres copies
 * the template's files directly, so cloning is fast and workers can't interfere.
 *
 * Nothing here reads the committed migration SQL, which is what lets the project use
 * `drizzle-kit push` day to day without tests drifting from schema.ts.
 */
const BASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'
const WORKER_ID = process.env.VITEST_POOL_ID ?? '1'
const DB_NAME = workerDatabase(WORKER_ID)

let handle: DatabaseHandle
let tables: string[] = []

/** The per-worker database every *.db.test.ts file should use. */
export function testDb() {
  if (!handle) throw new Error('test database not initialised — is setup.ts registered?')
  return handle.db
}

beforeAll(async () => {
  const admin = postgres(withDatabase(BASE_URL, MAINTENANCE_DB), { max: 1, onnotice: () => {} })
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
    // Postgres locks the template while copying it, so concurrent workers can lose the
    // race. Retry briefly rather than failing the run.
    await retry(() => admin.unsafe(`CREATE DATABASE "${DB_NAME}" TEMPLATE "${TEMPLATE_DB}"`))
  } finally {
    await admin.end({ timeout: 5 })
  }

  handle = createDatabase(withDatabase(BASE_URL, DB_NAME), { max: 2 })

  const rows = await handle.sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `
  tables = rows.map((r) => `"public"."${r.tablename}"`)
}, 60_000)

beforeEach(async () => {
  if (tables.length === 0) return
  // Discovered rather than hardcoded, so a new table can't silently leak between tests.
  await handle.db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`))
})

afterAll(async () => {
  await handle?.close()
  const admin = postgres(withDatabase(BASE_URL, MAINTENANCE_DB), { max: 1, onnotice: () => {} })
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
  } finally {
    await admin.end({ timeout: 5 })
  }
})

async function retry<T>(fn: () => Promise<T>, attempts = 10, delayMs = 250): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}
