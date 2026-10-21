import { describe, expect, it } from 'vitest'
import { mock, type MockProxy } from 'vitest-mock-extended'
import { aWidget } from '../../../test/factories'
import { ConflictError, NotFoundError } from '../lib/errors'
import { createSilentLogger } from '../lib/logger'
import type { WidgetRepository } from '../repositories/widget.repository'
import { createWidgetService } from './widget.service'

/** Template test: copy this for every new service. Real service, mocked repository. */
function setup(): {
  service: ReturnType<typeof createWidgetService>
  widgets: MockProxy<WidgetRepository>
} {
  const widgets = mock<WidgetRepository>()
  const service = createWidgetService({ widgets, logger: createSilentLogger() })
  return { service, widgets }
}

describe('createWidgetService', () => {
  describe('create', () => {
    it('creates a widget and returns it', async () => {
      const { service, widgets } = setup()
      const created = aWidget({ name: 'auth-service', score: 80 })
      widgets.findByName.mockResolvedValue(null)
      widgets.create.mockResolvedValue(created)

      const result = await service.create({ name: 'auth-service', status: 'active', score: 80 })

      expect(result).toBe(created)
      expect(widgets.create).toHaveBeenCalledWith({
        name: 'auth-service',
        status: 'active',
        score: 80,
      })
    })

    it('rejects a duplicate name with a domain error, without attempting the insert', async () => {
      const { service, widgets } = setup()
      widgets.findByName.mockResolvedValue(aWidget({ name: 'auth-service' }))

      await expect(
        service.create({ name: 'auth-service', status: 'active', score: 10 }),
      ).rejects.toThrow(ConflictError)

      expect(widgets.create).not.toHaveBeenCalled()
    })
  })

  describe('getById', () => {
    it('returns the widget when it exists', async () => {
      const { service, widgets } = setup()
      const widget = aWidget()
      widgets.findById.mockResolvedValue(widget)

      await expect(service.getById(widget.id)).resolves.toBe(widget)
    })

    it('throws NotFoundError for an unknown id', async () => {
      const { service, widgets } = setup()
      widgets.findById.mockResolvedValue(null)

      await expect(service.getById(crypto.randomUUID())).rejects.toThrow(NotFoundError)
    })
  })

  describe('list', () => {
    it('passes the filter straight through to the repository', async () => {
      const { service, widgets } = setup()
      widgets.list.mockResolvedValue([])

      await service.list({ status: 'active', minScore: 50 })

      expect(widgets.list).toHaveBeenCalledWith({ status: 'active', minScore: 50 })
    })
  })

  describe('update', () => {
    it('returns the updated widget', async () => {
      const { service, widgets } = setup()
      const updated = aWidget({ score: 77 })
      widgets.update.mockResolvedValue(updated)

      await expect(service.update(updated.id, { score: 77 })).resolves.toBe(updated)
      expect(widgets.update).toHaveBeenCalledWith(updated.id, { score: 77 })
    })

    it('turns a missing row into NotFoundError', async () => {
      const { service, widgets } = setup()
      widgets.update.mockResolvedValue(null)

      await expect(service.update(crypto.randomUUID(), { score: 1 })).rejects.toThrow(NotFoundError)
    })
  })

  describe('delete', () => {
    it('resolves when the row existed', async () => {
      const { service, widgets } = setup()
      widgets.delete.mockResolvedValue(true)

      await expect(service.delete(crypto.randomUUID())).resolves.toBeUndefined()
    })

    it('turns a missing row into NotFoundError', async () => {
      const { service, widgets } = setup()
      widgets.delete.mockResolvedValue(false)

      await expect(service.delete(crypto.randomUUID())).rejects.toThrow(NotFoundError)
    })
  })

  describe('refreshStale', () => {
    it('does no write when nothing is stale', async () => {
      const { service, widgets } = setup()
      widgets.findStale.mockResolvedValue([])

      expect(await service.refreshStale({ staleAfterMs: 0 })).toBe(0)
      expect(widgets.recordRefresh).not.toHaveBeenCalled()
    })

    it('recomputes scores for stale widgets and writes them in one batch', async () => {
      const { service, widgets } = setup()
      const stale = [aWidget({ name: 'alpha', score: 40 }), aWidget({ name: 'beta', score: 60 })]
      widgets.findStale.mockResolvedValue(stale)
      widgets.recordRefresh.mockResolvedValue(stale.length)

      const refreshed = await service.refreshStale({ staleAfterMs: 0, limit: 10 })

      expect(refreshed).toBe(2)
      expect(widgets.findStale).toHaveBeenCalledWith(expect.any(Date), 10)
      expect(widgets.recordRefresh).toHaveBeenCalledTimes(1)
      expect(widgets.recordRefresh).toHaveBeenCalledWith(
        [
          { id: stale[0]?.id, score: expect.any(Number) },
          { id: stale[1]?.id, score: expect.any(Number) },
        ],
        expect.any(Date),
      )
    })

    it('honours staleAfterMs when choosing the cutoff', async () => {
      const { service, widgets } = setup()
      widgets.findStale.mockResolvedValue([])
      const before = Date.now()

      await service.refreshStale({ staleAfterMs: 60_000 })

      const [cutoff] = widgets.findStale.mock.calls[0] ?? []
      expect(cutoff).toBeInstanceOf(Date)
      expect((cutoff as Date).getTime()).toBeLessThanOrEqual(before - 60_000 + 1_000)
    })

    it('clamps recomputed scores to 0-100', async () => {
      const { service, widgets } = setup()
      widgets.findStale.mockResolvedValue([
        aWidget({ name: 'at-ceiling', score: 100 }),
        aWidget({ name: 'at-floor', score: 0 }),
      ])
      widgets.recordRefresh.mockResolvedValue(2)

      await service.refreshStale({ staleAfterMs: 0 })

      const [updates] = widgets.recordRefresh.mock.calls[0] ?? []
      expect(updates).toHaveLength(2)
      for (const update of updates ?? []) {
        expect(update.score).toBeGreaterThanOrEqual(0)
        expect(update.score).toBeLessThanOrEqual(100)
      }
    })
  })
})
