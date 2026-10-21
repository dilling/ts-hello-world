import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { loadEnv } from '../env'
import { createDatabase } from './client'

/** Applies everything in ./drizzle. Run via `npm run db:migrate`. */
async function main(): Promise<void> {
  const env = loadEnv()
  // max: 1 — the migrator must run its statements on a single connection.
  const handle = createDatabase(env.DATABASE_URL, { max: 1 })

  try {
    await migrate(handle.db, { migrationsFolder: './drizzle' })
    console.log('migrations applied')
  } finally {
    await handle.close()
  }
}

await main()
