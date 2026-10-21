import { type Logger, pino } from 'pino'
import type { Env } from '../env'

export type { Logger }

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    // Pretty output locally; newline-delimited JSON everywhere else so a log
    // aggregator can actually parse it.
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
  })
}

/** For unit tests that need to satisfy a `logger` dependency without any output. */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' })
}
