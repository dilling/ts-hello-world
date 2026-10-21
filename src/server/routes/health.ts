import { Hono } from 'hono'
import type { HealthService } from '../services/health.service'

export function createHealthRoutes(services: { health: HealthService }) {
  return new Hono().get('/', async (c) => {
    const report = await services.health.check()
    return c.json(report, report.status === 'ok' ? 200 : 503)
  })
}
