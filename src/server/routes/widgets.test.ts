import { describe, expect, it } from 'vitest'
import { mock, type MockProxy } from 'vitest-mock-extended'
import { aWidget } from '../../../test/factories'
import { buildApp } from '../app'
import { createSilentLogger } from '../lib/logger'
import type { WidgetRepository } from '../repositories/widget.repository'
import type { HealthService } from '../services/health.service'
import { createWidgetService } from '../services/widget.service'

/**
 * HTTP concerns only — status codes, body shapes, validation. Data-access behaviour
 * belongs in the `.db.test.ts` files. Repository is mocked; the real service runs.
 */
function setup(): { app: ReturnType<typeof buildApp>; widgets: MockProxy<WidgetRepository> } {
  const widgets = mock<WidgetRepository>()
  const logger = createSilentLogger()

  const health = mock<HealthService>()
  health.check.mockResolvedValue({ status: 'ok', db: 'ok', queue: 'disabled', uptimeSeconds: 0 })

  const app = buildApp({
    services: { widgets: createWidgetService({ widgets, logger }), health },
    logger,
  })

  return { app, widgets }
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

describe('widget routes', () => {
  it('GET /api/widgets returns the list', async () => {
    const { app, widgets } = setup()
    widgets.list.mockResolvedValue([aWidget({ name: 'auth-service', score: 90 })])

    const res = await app.request('/api/widgets')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      widgets: [{ name: 'auth-service', score: 90 }],
    })
  })

  it('GET /api/widgets?status= forwards the parsed filter', async () => {
    const { app, widgets } = setup()
    widgets.list.mockResolvedValue([])

    const res = await app.request('/api/widgets?status=archived&minScore=50')

    await expect(res.json()).resolves.toEqual({ widgets: [] })
    expect(widgets.list).toHaveBeenCalledWith({ status: 'archived', minScore: 50 })
  })

  it('GET /api/widgets rejects an out-of-range filter', async () => {
    const { app } = setup()

    const res = await app.request('/api/widgets?status=nonsense')

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'validation_failed' } })
  })

  it('POST /api/widgets returns 201 with the created widget', async () => {
    const { app, widgets } = setup()
    const created = aWidget({ name: 'billing-api', score: 40 })
    widgets.findByName.mockResolvedValue(null)
    widgets.create.mockResolvedValue(created)

    const res = await app.request('/api/widgets', jsonPost({ name: 'billing-api', score: 40 }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ widget: { name: 'billing-api' } })
    expect(widgets.create).toHaveBeenCalledWith({
      name: 'billing-api',
      status: 'active',
      score: 40,
    })
  })

  it('POST /api/widgets rejects an invalid body with a consistent error shape', async () => {
    const { app, widgets } = setup()

    const res = await app.request('/api/widgets', jsonPost({ name: '', score: 500 }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'validation_failed' } })
    expect(widgets.create).not.toHaveBeenCalled()
  })

  it('POST /api/widgets maps a duplicate name to 409', async () => {
    const { app, widgets } = setup()
    widgets.findByName.mockResolvedValue(aWidget({ name: 'auth-service' }))

    const res = await app.request('/api/widgets', jsonPost({ name: 'auth-service' }))

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'conflict' } })
  })

  it('GET /api/widgets/:id returns the widget', async () => {
    const { app, widgets } = setup()
    const widget = aWidget({ name: 'checkout-web' })
    widgets.findById.mockResolvedValue(widget)

    const res = await app.request(`/api/widgets/${widget.id}`)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ widget: { name: 'checkout-web' } })
  })

  it('GET /api/widgets/:id maps NotFoundError to 404', async () => {
    const { app, widgets } = setup()
    widgets.findById.mockResolvedValue(null)

    const res = await app.request(`/api/widgets/${crypto.randomUUID()}`)

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })

  it('GET /api/widgets/:id rejects a non-uuid id before reaching the service', async () => {
    const { app, widgets } = setup()

    const res = await app.request('/api/widgets/not-a-uuid')

    expect(res.status).toBe(400)
    expect(widgets.findById).not.toHaveBeenCalled()
  })

  it('PATCH /api/widgets/:id returns the updated widget', async () => {
    const { app, widgets } = setup()
    const updated = aWidget({ name: 'billing-api', score: 77 })
    widgets.update.mockResolvedValue(updated)

    const res = await app.request(`/api/widgets/${updated.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 77 }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ widget: { score: 77 } })
    expect(widgets.update).toHaveBeenCalledWith(updated.id, { score: 77 })
  })

  it('PATCH with only a score does not also rewrite status', async () => {
    const { app, widgets } = setup()
    const paused = aWidget({ status: 'paused', score: 30 })
    widgets.update.mockResolvedValue({ ...paused, score: 77 })

    await app.request(`/api/widgets/${paused.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 77 }),
    })

    // updateWidgetSchema must not carry createWidgetSchema's defaults, or this would
    // silently un-pause the widget.
    expect(widgets.update).toHaveBeenCalledWith(paused.id, { score: 77 })
  })

  it('PATCH /api/widgets/:id maps a missing row to 404', async () => {
    const { app, widgets } = setup()
    widgets.update.mockResolvedValue(null)

    const res = await app.request(`/api/widgets/${crypto.randomUUID()}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ score: 10 }),
    })

    expect(res.status).toBe(404)
  })

  it('DELETE /api/widgets/:id returns 204 with no body', async () => {
    const { app, widgets } = setup()
    const id = crypto.randomUUID()
    widgets.delete.mockResolvedValue(true)

    const res = await app.request(`/api/widgets/${id}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    await expect(res.text()).resolves.toBe('')
    expect(widgets.delete).toHaveBeenCalledWith(id)
  })

  it('DELETE /api/widgets/:id maps a missing row to 404', async () => {
    const { app, widgets } = setup()
    widgets.delete.mockResolvedValue(false)

    const res = await app.request(`/api/widgets/${crypto.randomUUID()}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('POST /api/widgets/refresh reports how many were refreshed', async () => {
    const { app, widgets } = setup()
    widgets.findStale.mockResolvedValue([aWidget()])
    widgets.recordRefresh.mockResolvedValue(1)

    const res = await app.request('/api/widgets/refresh', { method: 'POST' })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ refreshed: 1 })
  })

  it('unknown routes return the standard error body', async () => {
    const { app } = setup()

    const res = await app.request('/api/nope')

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })

  it('an unexpected repository failure becomes a 500 without leaking detail', async () => {
    const { app, widgets } = setup()
    widgets.list.mockRejectedValue(new Error('connection terminated unexpectedly'))

    const res = await app.request('/api/widgets')

    expect(res.status).toBe(500)
    const body = await res.text()
    expect(body).toContain('internal_error')
    expect(body).not.toContain('connection terminated')
  })
})
