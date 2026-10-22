import type { PgBoss } from 'pg-boss'
import type { Logger } from '../lib/logger'
import type { WidgetService } from '../services/widget.service'
import { registerRefreshWidgetsJob } from './refresh-widgets.job'

export interface WorkerDeps {
  boss: PgBoss
  services: { widgets: WidgetService }
  logger: Logger
}

/** A job module's registration function: create its queue, attach handler, schedule it. */
type JobRegistration = (deps: WorkerDeps) => Promise<void>

/** Every job in the system. Registering a new one is a line here and nothing else. */
const JOB_REGISTRATIONS: JobRegistration[] = [
  registerRefreshWidgetsJob,
  // registerPollActionsJob,
]

/**
 * Starts pg-boss and registers every job in JOB_REGISTRATIONS, in the HTTP server's own
 * process. See src/server/jobs/README.md to split it out.
 */
export async function startWorker(deps: WorkerDeps): Promise<void> {
  await deps.boss.start()

  await Promise.all(JOB_REGISTRATIONS.map((register) => register(deps)))

  deps.logger.info({ jobs: JOB_REGISTRATIONS.length }, 'worker started')
}

export async function stopWorker(boss: PgBoss, logger: Logger): Promise<void> {
  // `graceful` lets in-flight handlers finish, up to `timeout`, before closing.
  await boss.stop({ graceful: true, close: true, timeout: 10_000 })
  logger.info('worker stopped')
}
