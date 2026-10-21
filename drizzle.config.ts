import { defineConfig } from 'drizzle-kit'

/**
 * Use `npm run db:generate` (writes SQL to ./drizzle) + `npm run db:migrate`.
 *
 * Do NOT use `drizzle-kit push`. Push mutates the database without emitting SQL files,
 * and the test harness builds its schema by replaying those files — so pushing makes
 * tests silently drift from the app. See README.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/app',
  },
  strict: true,
  verbose: true,
})
