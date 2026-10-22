import { TransactionRollbackError } from 'drizzle-orm/errors'
import { afterAll, beforeAll, test } from 'vitest'
import { createDatabase, type Database, type DatabaseHandle } from '../../src/server/db/client'
import { TEST_DB, withDatabase } from './names'

/**
 * Every DB test runs inside a transaction that is rolled back afterwards — the same
 * pattern as Rails' transactional fixtures or Django's TestCase. Nothing is ever
 * committed, so there's no cleanup step and no risk of one test's rows leaking into
 * another.
 *
 * Workers can share one database safely because uncommitted rows are invisible to other
 * connections. The one thing to know: two tests inserting the same unique value
 * concurrently will block each other until the first rolls back. Correct, just slower.
 *
 * Use `dbTest` instead of `it` in any *.db.test.ts file:
 *
 *   dbTest('does a thing', async ({ db }) => {
 *     const repo = createWidgetRepository(db)
 *   })
 */
const BASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'

let handle: DatabaseHandle

beforeAll(() => {
  handle = createDatabase(withDatabase(BASE_URL, TEST_DB), { max: 5 })
})

afterAll(async () => {
  await handle?.close()
})

export const dbTest = test.extend<{ db: Database }>({
  // The empty destructure is required: vitest parses this signature to work out
  // fixture dependencies and rejects a plain parameter name.
  db: async ({}, use) => {
    if (!handle) throw new Error('test database not initialised — is setup.ts registered?')

    try {
      await handle.db.transaction(async (tx) => {
        await use(tx)
        // Drizzle's documented way to request a rollback: throws
        // TransactionRollbackError, which we swallow below.
        tx.rollback()
      })
    } catch (error) {
      // Anything other than our own rollback request is a genuine failure.
      if (!(error instanceof TransactionRollbackError)) throw error
    }
  },
})
