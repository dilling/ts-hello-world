import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import postgres from 'postgres'
import { MAINTENANCE_DB, TEMPLATE_DB, WORKER_DB_PREFIX, withDatabase } from './names'

const run = promisify(execFile)

/**
 * Runs once per test run. Builds a template database from schema.ts with
 * `drizzle-kit push`, so tests never read the committed migration SQL — which is what
 * lets `push` be the day-to-day workflow without tests drifting from schema.ts.
 *
 * Each worker then clones this template (see setup.ts). Cloning needs the template to
 * have no open connections, so nothing here holds one open.
 *
 * Uses the CLI rather than `pushSchema` from drizzle-kit/api: that function terminates
 * the process during introspection without surfacing an error.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const baseUrl = process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app'

  await withAdmin(baseUrl, async (admin) => {
    await dropWorkerDatabases(admin)
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DB}" WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE "${TEMPLATE_DB}"`)
  })

  await run('npx', ['drizzle-kit', 'push', '--force'], {
    env: { ...process.env, DATABASE_URL: withDatabase(baseUrl, TEMPLATE_DB) },
  })

  return async () => {
    await withAdmin(baseUrl, async (admin) => {
      await dropWorkerDatabases(admin)
      await admin.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DB}" WITH (FORCE)`)
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

/** Clears leftovers from a previous run that crashed before teardown. */
async function dropWorkerDatabases(sql: postgres.Sql): Promise<void> {
  const rows = await sql<{ datname: string }[]>`
    select datname from pg_database where datname like ${`${WORKER_DB_PREFIX}%`}
  `
  for (const { datname } of rows) {
    await sql.unsafe(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`)
  }
}
