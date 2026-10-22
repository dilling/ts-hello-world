import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import postgres from 'postgres'
import { MAINTENANCE_DB, TEST_DB, withDatabase } from './names'

const run = promisify(execFile)

/**
 * Runs once per test run: recreate `app_test` and push schema.ts into it. See
 * test/README.md.
 *
 * Uses the CLI rather than `pushSchema` from drizzle-kit/api — that function terminates
 * the process during introspection without surfacing an error.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const baseUrl = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'

  await withAdmin(baseUrl, async (admin) => {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${TEST_DB}"`)
  })

  await run('npx', ['drizzle-kit', 'push', '--force'], {
    env: { ...process.env, DATABASE_URL: withDatabase(baseUrl, TEST_DB) },
  })

  return async () => {
    await withAdmin(baseUrl, async (admin) => {
      await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}" WITH (FORCE)`)
    })
  }
}

async function withAdmin(baseUrl: string, fn: (sql: postgres.Sql) => Promise<void>): Promise<void> {
  const admin = postgres(withDatabase(baseUrl, MAINTENANCE_DB), { max: 1, onnotice: () => {} })
  try {
    await fn(admin)
  } finally {
    await admin.end({ timeout: 5 })
  }
}
