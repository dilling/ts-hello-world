import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach } from 'vite-plus/test'
import { createDatabase, type DatabaseHandle } from '../../src/server/db/client'

/**
 * Each Vitest worker gets its own Postgres SCHEMA inside the same `app` database:
 * `test_1`, `test_2`, ... That means DB tests keep running in parallel without
 * stomping on each other, and there's no second database or container to manage.
 *
 * How it works: create the schema, point `search_path` at it, then replay the committed
 * ./drizzle/*.sql files. Drizzle emits unqualified DDL (`CREATE TABLE "widgets"`), so
 * the tables land in whichever schema `search_path` names.
 *
 * This is why the project uses `drizzle-kit generate` and NOT `drizzle-kit push` —
 * push doesn't write SQL files, so there'd be nothing here to replay and tests would
 * silently drift from the app schema. See README.
 */
const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../drizzle')

const workerId = process.env.VITEST_POOL_ID ?? '1'
export const TEST_SCHEMA = `test_${workerId}`

let handle: DatabaseHandle

/** The schema-scoped database every *.db.test.ts file should use. */
export function testDb() {
  if (!handle) throw new Error('test database not initialised — is setup.ts registered?')
  return handle.db
}

beforeAll(async () => {
  handle = createDatabase(process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app', {
    max: 1,
    // Every connection from this pool resolves unqualified names inside our schema.
    connection: { search_path: TEST_SCHEMA },
  })

  // Recreate from scratch so a crashed previous run can't leave junk behind.
  await handle.sql.unsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`)
  await handle.sql.unsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`)

  for (const statement of await loadMigrationStatements()) {
    await handle.sql.unsafe(statement)
  }
}, 30_000)

beforeEach(async () => {
  // Cheaper and simpler than transaction rollback, and it doesn't interfere with code
  // under test that opens its own transactions.
  await handle.db.execute(
    sql`TRUNCATE TABLE ${sql.raw(`"${TEST_SCHEMA}"."widgets"`)} RESTART IDENTITY CASCADE`,
  )
})

afterAll(async () => {
  await handle?.sql.unsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`)
  await handle?.close()
})

async function loadMigrationStatements(): Promise<string[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()

  const statements: string[] = []
  for (const file of files) {
    const contents = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
    // Drizzle separates statements with this marker rather than bare semicolons, which
    // is what makes it safe to split without a SQL parser.
    for (const part of contents.split('--> statement-breakpoint')) {
      const trimmed = part.trim()
      if (trimmed.length > 0) statements.push(trimmed)
    }
  }

  if (statements.length === 0) {
    throw new Error(`No migrations found in ${MIGRATIONS_DIR} — run \`npm run db:generate\``)
  }

  return statements
}
