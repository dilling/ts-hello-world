import type { PgBoss } from 'pg-boss'
import type { Logger } from '../lib/logger'
import type { WidgetService } from '../services/widget.service'
import { registerRefreshWidgetsJob } from './refresh-widgets.job'

export interface WorkerDeps {
  boss: PgBoss
  services: { widgets: WidgetService }
  logger: Logger
}

/**
 * Starts pg-boss and registers every job. Add new jobs to the list below — that's the
 * only place that needs to change.
 *
 * This currently runs in the same process as the HTTP server (one thing to deploy).
 * To split it out: make a `src/server/worker-entry.ts` that builds the container and
 * calls this, and drop the `startWorker` call from index.ts. Nothing else changes.
 */
export async function startWorker(deps: WorkerDeps): Promise<void> {
  await deps.boss.start()

  await Promise.all([
    registerRefreshWidgetsJob(deps),
    // registerPollActionsJob(deps),
  ])

  deps.logger.info('worker started')
}

export async function stopWorker(boss: PgBoss, logger: Logger): Promise<void> {
  // `graceful` lets in-flight handlers finish, up to `timeout`, before closing.
  await boss.stop({ graceful: true, close: true, timeout: 10_000 })
  logger.info('worker stopped')
}
