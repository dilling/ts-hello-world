import type { PgBoss } from 'pg-boss'
import type { Logger } from '../lib/logger'
import type { WidgetService } from '../services/widget.service'

/**
 * PATTERN for a background job. Three parts, and keeping them separate is the point:
 *
 *  1. QUEUE_NAME + the payload type — the contract.
 *  2. `register()` — creates the queue, attaches the handler, declares the schedule.
 *  3. the handler itself — a THIN trigger that calls a service. It must not contain
 *     business logic, or that logic becomes untestable without a running queue.
 *
 * Tomorrow's repo poller is this file with a different service call.
 */
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
  // pg-boss v10+ requires queues to exist before you send to or work them.
  // Idempotent, so it's safe on every boot. Retention is a per-queue setting in v12:
  // keep finished jobs for a day, which is long enough to debug a bad run.
  await boss.createQueue(REFRESH_WIDGETS_QUEUE, {
    retentionSeconds: 86_400,
    deleteAfterSeconds: 86_400,
  })

  // Handlers receive a BATCH of jobs. With batchSize 1 that's an array of one, but
  // writing the loop now means raising batchSize later is a config change, not a rewrite.
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
