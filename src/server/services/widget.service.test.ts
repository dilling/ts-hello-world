import { describe, expect, it } from 'vitest'
import type { Widget } from '../../shared/widget'
import { ConflictError, NotFoundError } from '../lib/errors'
import { createSilentLogger } from '../lib/logger'
import { createInMemoryWidgetRepository } from '../repositories/widget.repository.memory'
import { createWidgetService } from './widget.service'

/**
 * THE TEMPLATE TEST. Copy this file for every new service.
 *
 * No database, no HTTP, no mocking library — just the real service wired to the
 * in-memory repository. Runs in milliseconds, so there's no excuse not to write them.
 */
function setup(seed: Widget[] = []) {
  const widgets = createInMemoryWidgetRepository(seed)
  const service = createWidgetService({ widgets, logger: createSilentLogger() })
  return { service, widgets }
}

function aWidget(overrides: Partial<Widget> = {}): Widget {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'example',
    status: 'active',
    score: 50,
    lastRefreshedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('createWidgetService', () => {
  describe('create', () => {
    it('creates a widget', async () => {
      const { service } = setup()

      const widget = await service.create({ name: 'auth-service', status: 'active', score: 80 })

      expect(widget).toMatchObject({ name: 'auth-service', score: 80 })
      expect(await service.list()).toHaveLength(1)
    })

    it('rejects a duplicate name with a domain error', async () => {
      const { service } = setup([aWidget({ name: 'auth-service' })])

      await expect(
        service.create({ name: 'auth-service', status: 'active', score: 10 }),
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('getById', () => {
    it('throws NotFoundError for an unknown id', async () => {
      const { service } = setup()

      // The route layer relies on this throwing — app.onError turns it into a 404.
      await expect(service.getById(crypto.randomUUID())).rejects.toThrow(NotFoundError)
    })
  })

  describe('list', () => {
    it('filters by status and minimum score', async () => {
      const { service } = setup([
        aWidget({ name: 'a', status: 'active', score: 90 }),
        aWidget({ name: 'b', status: 'active', score: 20 }),
        aWidget({ name: 'c', status: 'archived', score: 95 }),
      ])

      const result = await service.list({ status: 'active', minScore: 50 })

      expect(result.map((w) => w.name)).toEqual(['a'])
    })
  })

  describe('refreshStale', () => {
    it('refreshes never-refreshed active widgets', async () => {
      const { service, widgets } = setup([aWidget({ name: 'stale', lastRefreshedAt: null })])

      const refreshed = await service.refreshStale({ staleAfterMs: 0 })

      expect(refreshed).toBe(1)
      expect(widgets.all()[0]?.lastRefreshedAt).not.toBeNull()
    })

    it('skips widgets refreshed recently', async () => {
      const { service } = setup([
        aWidget({ name: 'fresh', lastRefreshedAt: new Date().toISOString() }),
      ])

      expect(await service.refreshStale({ staleAfterMs: 60_000 })).toBe(0)
    })

    it('ignores paused and archived widgets', async () => {
      const { service } = setup([
        aWidget({ name: 'paused', status: 'paused' }),
        aWidget({ name: 'archived', status: 'archived' }),
      ])

      expect(await service.refreshStale({ staleAfterMs: 0 })).toBe(0)
    })

    it('keeps scores within 0-100', async () => {
      const { service, widgets } = setup([
        aWidget({ name: 'high', score: 100 }),
        aWidget({ name: 'low', score: 0 }),
      ])

      await service.refreshStale({ staleAfterMs: 0 })

      for (const widget of widgets.all()) {
        expect(widget.score).toBeGreaterThanOrEqual(0)
        expect(widget.score).toBeLessThanOrEqual(100)
      }
    })
  })
})
