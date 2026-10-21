import { describe, expect, it } from 'vitest'
import { testDb } from '../../../test/db/setup'
import { createWidgetRepository } from './widget.repository'

/**
 * `.db.test.ts` runs in the `db` Vitest project against real Postgres in its own
 * schema (see test/db/setup.ts). Requires `npm run db:up`.
 *
 * Keep these focused on things the in-memory repository can't prove: actual SQL,
 * constraints, ordering, and Date -> ISO-string mapping. Business rules belong in
 * service tests, which don't need any of this.
 */
describe('widgetRepository (postgres)', () => {
  const repo = () => createWidgetRepository(testDb())

  it('round-trips a widget with ISO string timestamps', async () => {
    const created = await repo().create({ name: 'auth-service', status: 'active', score: 88 })

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    // The mapper's whole job: never leak a Date past the repository.
    expect(typeof created.createdAt).toBe('string')
    expect(created.lastRefreshedAt).toBeNull()

    await expect(repo().findById(created.id)).resolves.toMatchObject({ name: 'auth-service' })
  })

  it('enforces the unique name constraint at the database level', async () => {
    await repo().create({ name: 'billing-api', status: 'active', score: 10 })

    await expect(
      repo().create({ name: 'billing-api', status: 'active', score: 20 }),
    ).rejects.toThrow()
  })

  it('lists alphabetically and applies filters in SQL', async () => {
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

  it('findStale puts never-refreshed rows first and excludes inactive ones', async () => {
    const never = await repo().create({ name: 'never', status: 'active', score: 0 })
    const refreshed = await repo().create({ name: 'refreshed', status: 'active', score: 0 })
    await repo().create({ name: 'paused', status: 'paused', score: 0 })

    await repo().recordRefresh([{ id: refreshed.id, score: 50 }], new Date(Date.now() - 60_000))

    const stale = await repo().findStale(new Date(), 10)

    expect(stale.map((w) => w.name)).toEqual(['never', 'refreshed'])
    expect(stale[0]?.id).toBe(never.id)
  })

  it('recordRefresh bulk-updates in one statement and reports the count', async () => {
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

  it('recordRefresh with no updates is a no-op', async () => {
    await expect(repo().recordRefresh([], new Date())).resolves.toBe(0)
  })

  it('update and delete report absence rather than throwing', async () => {
    const missing = crypto.randomUUID()

    await expect(repo().update(missing, { score: 1 })).resolves.toBeNull()
    await expect(repo().delete(missing)).resolves.toBe(false)
  })
})
