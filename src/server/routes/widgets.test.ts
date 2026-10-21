import { describe, expect, it } from 'vite-plus/test'
import { buildApp } from '../app'
import { createSilentLogger } from '../lib/logger'
import { createInMemoryWidgetRepository } from '../repositories/widget.repository.memory'
import type { HealthService } from '../services/health.service'
import { createWidgetService } from '../services/widget.service'

/**
 * Route tests: real routing, real validation, real error handling — no database.
 *
 * `buildApp` takes services as an argument precisely so this is possible, and
 * `app.request()` is Hono's built-in fetch-style harness, so there's no supertest and
 * no port to bind.
 */
function setup() {
  const widgets = createInMemoryWidgetRepository()
  const logger = createSilentLogger()

  const health: HealthService = {
    check: async () => ({ status: 'ok', db: 'ok', queue: 'disabled', uptimeSeconds: 0 }),
  }

  const app = buildApp({
    services: { widgets: createWidgetService({ widgets, logger }), health },
    logger,
  })

  return { app, widgets }
}

async function createWidget(app: ReturnType<typeof setup>['app'], name: string, score = 50) {
  const res = await app.request('/api/widgets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, score }),
  })
  const body = (await res.json()) as { widget: { id: string } }
  return body.widget
}

describe('widget routes', () => {
  it('GET /api/widgets returns the list', async () => {
    const { app } = setup()
    await createWidget(app, 'auth-service', 90)

    const res = await app.request('/api/widgets')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      widgets: [{ name: 'auth-service', score: 90 }],
    })
  })

  it('GET /api/widgets?status= filters', async () => {
    const { app } = setup()
    await createWidget(app, 'active-one')

    const res = await app.request('/api/widgets?status=archived')

    await expect(res.json()).resolves.toEqual({ widgets: [] })
  })

  it('POST /api/widgets rejects an invalid body with a consistent error shape', async () => {
    const { app } = setup()

    const res = await app.request('/api/widgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', score: 500 }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'validation_failed' } })
  })

  it('POST /api/widgets maps a duplicate name to 409', async () => {
    const { app } = setup()
    await createWidget(app, 'auth-service')

    const res = await app.request('/api/widgets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'auth-service' }),
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'conflict' } })
  })

  it('GET /api/widgets/:id maps NotFoundError to 404', async () => {
    const { app } = setup()

    const res = await app.request(`/api/widgets/${crypto.randomUUID()}`)

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })

  it('GET /api/widgets/:id rejects a non-uuid id before reaching the service', async () => {
    const { app } = setup()

    const res = await app.request('/api/widgets/not-a-uuid')

    expect(res.status).toBe(400)
  })

  it('PATCH then GET reflects the update', async () => {
    const { app } = setup()
    const widget = await createWidget(app, 'billing-api', 40)

    const patched = await app.request(`/api/widgets/${widget.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 77 }),
    })

    expect(patched.status).toBe(200)

    const reread = await app.request(`/api/widgets/${widget.id}`)
    await expect(reread.json()).resolves.toMatchObject({ widget: { score: 77 } })
  })

  it('DELETE returns 204 and the widget is gone', async () => {
    const { app } = setup()
    const widget = await createWidget(app, 'legacy-cron')

    expect((await app.request(`/api/widgets/${widget.id}`, { method: 'DELETE' })).status).toBe(204)
    expect((await app.request(`/api/widgets/${widget.id}`)).status).toBe(404)
  })

  it('unknown routes return the standard error body', async () => {
    const { app } = setup()

    const res = await app.request('/api/nope')

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })
})
