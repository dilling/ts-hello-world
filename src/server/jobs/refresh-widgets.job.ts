import type { PgBoss } from 'pg-boss'
import type { Logger } from '../lib/logger'
import type { WidgetService } from '../services/widget.service'

/** The template for a background job. See src/server/jobs/README.md. */
export const REFRESH_WIDGETS_QUEUE = 'refresh-widgets'

export interface RefreshWidgetsPayload {
  staleAfterMs?: number
  limit?: number
}

/** Every 5 minutes. pg-boss cron is UTC. */
export const REFRESH_WIDGETS_CRON = '*/5 * * * *'

export interface RefreshWidgetsDeps {
  boss: PgBoss
  services: { widgets: WidgetService }
  logger: Logger
}

export async function registerRefreshWidgetsJob({
  boss,
  services,
  logger,
}: RefreshWidgetsDeps): Promise<void> {
  // pg-boss v10+ requires a queue to exist before you send to or work it. Idempotent, so
  // it's safe on every boot. Retention is per-queue in v12; a day is enough to debug.
  await boss.createQueue(REFRESH_WIDGETS_QUEUE, {
    retentionSeconds: 86_400,
    deleteAfterSeconds: 86_400,
  })

  // Handlers receive a batch; with batchSize 1 that's an array of one.
  await boss.work<RefreshWidgetsPayload>(REFRESH_WIDGETS_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const refreshed = await services.widgets.refreshStale(job.data ?? {})
      logger.info({ jobId: job.id, refreshed }, 'refresh-widgets job complete')
    }
  })

  // Idempotent: re-running with the same name updates the existing schedule.
  await boss.schedule(REFRESH_WIDGETS_QUEUE, REFRESH_WIDGETS_CRON)

  logger.info({ queue: REFRESH_WIDGETS_QUEUE, cron: REFRESH_WIDGETS_CRON }, 'job registered')
}
