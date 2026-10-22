import { TransactionRollbackError } from 'drizzle-orm/errors'
import { afterAll, beforeAll, test } from 'vitest'
import { createDatabase, type Database, type DatabaseHandle } from '../../src/server/db/client'
import { TEST_DB, withDatabase } from './names'

const BASE_URL = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'

let handle: DatabaseHandle

beforeAll(() => {
  handle = createDatabase(withDatabase(BASE_URL, TEST_DB), { max: 5 })
})

afterAll(async () => {
  await handle?.close()
})

/** Runs the test in a transaction that is rolled back afterwards. See test/README.md. */
export const dbTest = test.extend<{ db: Database }>({
  // The empty destructure is required: vitest parses this signature for fixture
  // dependencies and rejects a plain parameter name.
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
