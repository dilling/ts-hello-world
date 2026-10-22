import type {
  CreateWidgetInput,
  ListWidgetsQuery,
  UpdateWidgetInput,
  Widget,
} from '../../shared/widget'
import { ConflictError, NotFoundError } from '../lib/errors'
import type { Logger } from '../lib/logger'
import type { WidgetRepository } from '../repositories/widget.repository'

/**
 * Behaviour, business rules and domain errors. See src/server/README.md.
 *
 * `getById` throws `NotFoundError` where the repository's `findById` returns null.
 */
export interface WidgetService {
  list(filter?: ListWidgetsQuery): Promise<Widget[]>
  getById(id: string): Promise<Widget>
  create(input: CreateWidgetInput): Promise<Widget>
  update(id: string, patch: UpdateWidgetInput): Promise<Widget>
  delete(id: string): Promise<void>
  /** Entry point for the background job. Returns how many rows it refreshed. */
  refreshStale(options?: { staleAfterMs?: number; limit?: number }): Promise<number>
}

export interface WidgetServiceDeps {
  widgets: WidgetRepository
  logger: Logger
}

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000
const DEFAULT_REFRESH_LIMIT = 50

export function createWidgetService({ widgets, logger }: WidgetServiceDeps): WidgetService {
  return {
    list(filter) {
      return widgets.list(filter)
    },

    async getById(id) {
      const widget = await widgets.findById(id)
      if (!widget) throw new NotFoundError('Widget', id)
      return widget
    },

    async create(input) {
      // A nicer message than Postgres 23505, not the enforcement — the unique constraint
      // is still the real guarantee.
      const existing = await widgets.findByName(input.name)
      if (existing) {
        throw new ConflictError(`A widget named '${input.name}' already exists`)
      }

      const widget = await widgets.create(input)
      logger.info({ widgetId: widget.id, name: widget.name }, 'widget created')
      return widget
    },

    async update(id, patch) {
      const updated = await widgets.update(id, patch)
      if (!updated) throw new NotFoundError('Widget', id)
      return updated
    },

    async delete(id) {
      const deleted = await widgets.delete(id)
      if (!deleted) throw new NotFoundError('Widget', id)
    },

    async refreshStale(options = {}) {
      const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
      const limit = options.limit ?? DEFAULT_REFRESH_LIMIT

      const stale = await widgets.findStale(new Date(Date.now() - staleAfterMs), limit)
      if (stale.length === 0) {
        logger.debug('no stale widgets to refresh')
        return 0
      }

      // Stand-in for the real work: call an external API, parse a report, compute a metric.
      const updates = stale.map((widget) => ({
        id: widget.id,
        score: nextScore(widget),
      }))

      const refreshed = await widgets.recordRefresh(updates, new Date())
      logger.info({ refreshed, candidates: stale.length }, 'refreshed stale widgets')
      return refreshed
    },
  }
}

/** Deterministic pseudo-metric so the dashboard visibly changes when the job runs. */
function nextScore(widget: Widget): number {
  const drift = (widget.name.length * 7 + widget.score * 3) % 21
  return Math.min(100, Math.max(0, widget.score + drift - 10))
}
