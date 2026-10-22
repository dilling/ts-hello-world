import { z } from 'zod'

/**
 * The local compose database, so a fresh clone runs with no `.env`. Throwaway
 * credentials, identical to docker-compose.yml and only reachable on your machine.
 */
export const DEV_DATABASE_URL = 'postgres://app:app@localhost:5432/app'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default(DEV_DATABASE_URL),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type Env = z.infer<typeof envSchema>

/** Parse once at startup and fail loudly. `source` is an argument so tests can pass one. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`)
  }

  const env = result.data

  // Without this, production silently boots against a localhost database and reports
  // itself healthy. Checks `source`, not `env`: after parsing, a defaulted value is
  // indistinguishable from a supplied one.
  if (env.NODE_ENV === 'production' && !source.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set explicitly when NODE_ENV=production.\n' +
        `Refusing to fall back to the local development default (${DEV_DATABASE_URL}).`,
    )
  }

  return env
}
