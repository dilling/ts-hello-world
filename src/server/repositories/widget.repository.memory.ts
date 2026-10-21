import { randomUUID } from 'node:crypto'
import type { Widget } from '../../shared/widget'
import type { WidgetRepository } from './widget.repository'

/**
 * In-memory implementation of WidgetRepository.
 *
 * Two jobs: (1) it makes service tests fast and Docker-free, and (2) it's the clearest
 * statement of the repository's contract — if you can't implement a method here, the
 * method is probably leaking query logic that belongs in the Drizzle impl.
 *
 * Keep behaviour faithful to the real one (ordering, null handling, return types).
 */
export function createInMemoryWidgetRepository(seed: Widget[] = []): WidgetRepository & {
  /** Test-only escape hatch for asserting on stored state. */
  all: () => Widget[]
} {
  const store = new Map<string, Widget>(seed.map((w) => [w.id, w]))

  const byName = (a: Widget, b: Widget) => a.name.localeCompare(b.name)

  return {
    all: () => [...store.values()],

    async list(filter = {}) {
      return [...store.values()]
        .filter((w) => (filter.status ? w.status === filter.status : true))
        .filter((w) => (filter.minScore !== undefined ? w.score >= filter.minScore : true))
        .sort(byName)
    },

    async findById(id) {
      return store.get(id) ?? null
    },

    async findByName(name) {
      return [...store.values()].find((w) => w.name === name) ?? null
    },

    async create(input) {
      const now = new Date().toISOString()
      const widget: Widget = {
        id: randomUUID(),
        name: input.name,
        status: input.status ?? 'active',
        score: input.score ?? 0,
        lastRefreshedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      store.set(widget.id, widget)
      return widget
    },

    async update(id, patch) {
      const existing = store.get(id)
      if (!existing) return null

      const updated: Widget = { ...existing, ...patch, updatedAt: new Date().toISOString() }
      store.set(id, updated)
      return updated
    },

    async delete(id) {
      return store.delete(id)
    },

    async findStale(staleBefore, limit) {
      return [...store.values()]
        .filter((w) => w.status === 'active')
        .filter((w) => w.lastRefreshedAt === null || new Date(w.lastRefreshedAt) < staleBefore)
        .sort((a, b) => {
          // Mirror "nulls first" from the SQL ordering.
          if (a.lastRefreshedAt === null) return b.lastRefreshedAt === null ? 0 : -1
          if (b.lastRefreshedAt === null) return 1
          return a.lastRefreshedAt.localeCompare(b.lastRefreshedAt)
        })
        .slice(0, limit)
    },

    async recordRefresh(updates, at) {
      let count = 0
      for (const { id, score } of updates) {
        const existing = store.get(id)
        if (!existing) continue
        store.set(id, {
          ...existing,
          score,
          lastRefreshedAt: at.toISOString(),
          updatedAt: at.toISOString(),
        })
        count += 1
      }
      return count
    },
  }
}
