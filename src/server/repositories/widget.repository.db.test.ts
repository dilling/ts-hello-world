import { describe, expect } from 'vitest'
import { dbTest } from '../../../test/db/setup'
import { createWidgetRepository } from './widget.repository'

/**
 * Real Postgres, each test in a rolled-back transaction (`dbTest` — see
 * test/db/setup.ts). Requires `npm run db:up`.
 *
 * Keep these focused on what mocks can't prove: real SQL, constraints, ordering, and the
 * Date -> ISO-string mapping. Business rules belong in the service tests.
 */
describe('widgetRepository (postgres)', () => {
  dbTest('round-trips a widget with ISO string timestamps', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    const created = await repo().create({ name: 'auth-service', status: 'active', score: 88 })

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    // The mapper's whole job: never leak a Date past the repository.
    expect(typeof created.createdAt).toBe('string')
    expect(created.lastRefreshedAt).toBeNull()

    await expect(repo().findById(created.id)).resolves.toMatchObject({ name: 'auth-service' })
  })

  dbTest('enforces the unique name constraint at the database level', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    await repo().create({ name: 'billing-api', status: 'active', score: 10 })

    await expect(
      repo().create({ name: 'billing-api', status: 'active', score: 20 }),
    ).rejects.toThrow()
  })

  dbTest('lists alphabetically and applies filters in SQL', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    await repo().create({ name: 'zeta', status: 'active', score: 90 })
    await repo().create({ name: 'alpha', status: 'active', score: 20 })
    await repo().create({ name: 'mid', status: 'archived', score: 95 })

    await expect(
      repo()
        .list()
        .then((r) => r.map((w) => w.name)),
    ).resolves.toEqual(['alpha', 'mid', 'zeta'])
    await expect(
      repo()
        .list({ status: 'active', minScore: 50 })
        .then((r) => r.map((w) => w.name)),
    ).resolves.toEqual(['zeta'])
  })

  dbTest('findStale puts never-refreshed rows first and excludes inactive ones', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    const never = await repo().create({ name: 'never', status: 'active', score: 0 })
    const refreshed = await repo().create({ name: 'refreshed', status: 'active', score: 0 })
    await repo().create({ name: 'paused', status: 'paused', score: 0 })

    await repo().recordRefresh([{ id: refreshed.id, score: 50 }], new Date(Date.now() - 60_000))

    const stale = await repo().findStale(new Date(), 10)

    expect(stale.map((w) => w.name)).toEqual(['never', 'refreshed'])
    expect(stale[0]?.id).toBe(never.id)
  })

  dbTest('recordRefresh bulk-updates in one statement and reports the count', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    const a = await repo().create({ name: 'a', status: 'active', score: 1 })
    const b = await repo().create({ name: 'b', status: 'active', score: 2 })
    const at = new Date()

    const count = await repo().recordRefresh(
      [
        { id: a.id, score: 71 },
        { id: b.id, score: 72 },
      ],
      at,
    )

    expect(count).toBe(2)
    await expect(repo().findById(a.id)).resolves.toMatchObject({ score: 71 })
    await expect(repo().findById(b.id)).resolves.toMatchObject({
      score: 72,
      lastRefreshedAt: at.toISOString(),
    })
  })

  dbTest('recordRefresh with no updates is a no-op', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    await expect(repo().recordRefresh([], new Date())).resolves.toBe(0)
  })

  dbTest('update and delete report absence rather than throwing', async ({ db }) => {
    const repo = () => createWidgetRepository(db)

    const missing = crypto.randomUUID()

    await expect(repo().update(missing, { score: 1 })).resolves.toBeNull()
    await expect(repo().delete(missing)).resolves.toBe(false)
  })
})
