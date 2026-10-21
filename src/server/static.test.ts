import { describe, expect, it } from 'vitest'
import { buildApp } from './app'
import { createSilentLogger } from './lib/logger'
import { mock } from 'vitest-mock-extended'
import type { WidgetRepository } from './repositories/widget.repository'
import type { HealthService } from './services/health.service'
import { createWidgetService } from './services/widget.service'
import { mountSpa } from './static'

/**
 * Regression tests for production SPA serving: a real static file must not get
 * index.html, and an unknown /api route must return JSON rather than the HTML shell.
 */
const FIXTURE_DIST = './test/fixtures/dist-web'

function setup() {
  const logger = createSilentLogger()
  const health = mock<HealthService>()
  health.check.mockResolvedValue({ status: 'ok', db: 'ok', queue: 'disabled', uptimeSeconds: 0 })
  const app = buildApp({
    services: {
      widgets: createWidgetService({ widgets: mock<WidgetRepository>(), logger }),
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
