import type { CreateWidgetInput } from '../../shared/widget'
import { loadEnv } from '../env'
import { createDatabase } from './client'
import { widgets } from './schema'

/** A few rows so the dashboard isn't empty on first run. `npm run db:seed`. */
const SEED_WIDGETS: CreateWidgetInput[] = [
  { name: 'auth-service', status: 'active', score: 92 },
  { name: 'billing-api', status: 'active', score: 68 },
  { name: 'checkout-web', status: 'active', score: 74 },
  { name: 'data-pipeline', status: 'paused', score: 41 },
  { name: 'legacy-cron', status: 'archived', score: 12 },
  { name: 'notification-worker', status: 'active', score: 85 },
]

async function main(): Promise<void> {
  const env = loadEnv()
  const handle = createDatabase(env.DATABASE_URL, { max: 1 })

  try {
    const inserted = await handle.db
      .insert(widgets)
      .values(SEED_WIDGETS)
      // Idempotent: re-seeding an already-seeded DB is a no-op rather than an error.
      .onConflictDoNothing({ target: widgets.name })
      .returning({ name: widgets.name })

    console.log(`seeded ${inserted.length} widget(s)`)
  } finally {
    await handle.close()
  }
}

await main()
