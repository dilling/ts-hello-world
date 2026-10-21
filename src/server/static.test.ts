import { describe, expect, it } from 'vite-plus/test'
import { buildApp } from './app'
import { createSilentLogger } from './lib/logger'
import { createInMemoryWidgetRepository } from './repositories/widget.repository.memory'
import type { HealthService } from './services/health.service'
import { createWidgetService } from './services/widget.service'
import { mountSpa } from './static'

/**
 * Regression tests for production SPA serving.
 *
 * This went wrong twice while building the template: first the static mount was scoped
 * to /assets only (so a real favicon got index.html), then the SPA fallback swallowed
 * unmatched /api routes (so a mistyped endpoint returned the HTML shell instead of a
 * JSON 404 — a confusing failure for any API client). Both are production-only, which
 * is exactly why they need a test rather than a careful comment.
 */
const FIXTURE_DIST = './test/fixtures/dist-web'

function setup() {
  const logger = createSilentLogger()
  const health: HealthService = {
    check: async () => ({ status: 'ok', db: 'ok', queue: 'disabled', uptimeSeconds: 0 }),
  }
  const app = buildApp({
    services: {
      widgets: createWidgetService({ widgets: createInMemoryWidgetRepository(), logger }),
      health,
    },
    logger,
  })
  mountSpa(app, FIXTURE_DIST)
  return app
}

describe('mountSpa', () => {
  it('serves index.html at the root', async () => {
    const res = await setup().request('/')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    await expect(res.text()).resolves.toContain('fixture spa')
  })

  it('serves a deep link with the SPA shell so the client router can handle it', async () => {
    const res = await setup().request('/widgets/a2d4f8c0-0000-4000-8000-000000000000')

    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toContain('fixture spa')
  })

  it('serves real static files, not just /assets', async () => {
    const app = setup()

    const asset = await app.request('/assets/app.js')
    expect(asset.status).toBe(200)
    await expect(asset.text()).resolves.toContain('bundle')

    // The bug: this used to fall through to index.html.
    const favicon = await app.request('/favicon.svg')
    expect(favicon.status).toBe(200)
    await expect(favicon.text()).resolves.toContain('<svg')
  })

  it('still answers the API rather than shadowing it with the SPA', async () => {
    const res = await setup().request('/api/health')

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('returns a JSON 404 for an unknown /api route, NOT the HTML shell', async () => {
    const res = await setup().request('/api/nope')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })

  it('keeps domain errors as JSON under the SPA fallback', async () => {
    const res = await setup().request('/api/widgets/a2d4f8c0-0000-4000-8000-000000000000')

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
  })
})
