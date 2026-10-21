import { describe, expect, it } from 'vitest'
import { DEV_DATABASE_URL, loadEnv } from './env'

describe('loadEnv', () => {
  it('runs with a completely empty environment, so a fresh clone needs no .env', () => {
    const env = loadEnv({})

    expect(env).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL: DEV_DATABASE_URL,
      PORT: 3000,
      LOG_LEVEL: 'info',
    })
  })

  it('prefers a supplied DATABASE_URL over the default', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://u:p@db.example.com:5432/prod' })

    expect(env.DATABASE_URL).toBe('postgres://u:p@db.example.com:5432/prod')
  })

  it('coerces PORT from its string form', () => {
    expect(loadEnv({ PORT: '8080' }).PORT).toBe(8080)
  })

  it('rejects a non-numeric PORT rather than silently using NaN', () => {
    expect(() => loadEnv({ PORT: 'http' })).toThrow(/PORT/)
  })

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => loadEnv({ LOG_LEVEL: 'chatty' })).toThrow(/LOG_LEVEL/)
  })

  it('refuses to fall back to the dev database in production', () => {
    // The whole point of the guard: in production the app must not boot pointing at a
    // localhost database it inherited from a default.
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/must be set explicitly/)
  })

  it('accepts production when DATABASE_URL is explicit', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://u:p@db.example.com:5432/prod',
    })

    expect(env.NODE_ENV).toBe('production')
  })

  it('still allows production to point at the dev URL if asked explicitly', () => {
    // `npm run build && npm start` against local Postgres is a legitimate thing to do;
    // the guard is about silence, not about the value itself.
    const env = loadEnv({ NODE_ENV: 'production', DATABASE_URL: DEV_DATABASE_URL })

    expect(env.DATABASE_URL).toBe(DEV_DATABASE_URL)
  })
})
