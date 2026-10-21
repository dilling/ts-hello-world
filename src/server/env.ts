import { z } from 'zod'

/**
 * The local compose database. Defaulting to it means a fresh clone runs with
 * `npm run db:up && npm run dev` — no .env to copy, nothing to drift out of date.
 * Safe to hardcode: these are throwaway local credentials, identical to the ones in
 * docker-compose.yml, and never reachable from anywhere but your machine.
 */
export const DEV_DATABASE_URL = 'postgres://app:app@localhost:5432/app'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default(DEV_DATABASE_URL),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse once at startup and fail loudly. Takes `source` as an argument rather than
 * reading `process.env` at module scope so tests can pass a fixture.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }

  const env = result.data

  // The dev default is a footgun in production: the app would boot, connect to a
  // localhost database that isn't there (or worse, one that is but shouldn't be), and
  // report itself healthy. Checking `source` rather than `env` is deliberate — after
  // parsing, a defaulted value is indistinguishable from a supplied one.
  if (env.NODE_ENV === 'production' && !source.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set explicitly when NODE_ENV=production.\n' +
        `Refusing to fall back to the local development default (${DEV_DATABASE_URL}).`,
    )
  }

  return env
}
