import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'

/** Just the bits of a Hono app this needs, so the caller's chained route type survives. */
type Mountable = Pick<Hono, 'use' | 'get'>

/**
 * Serves the built SPA from `root` alongside the API, so production is one artifact on
 * one port.
 *
 * Mounted as statements rather than chained onto the app, because chaining would widen
 * the inferred type that `AppType` (and therefore the RPC client) depends on.
 */
export function mountSpa(app: Mountable, root: string): void {
  // Any real file in the dist dir: hashed bundles under /assets, plus whatever Vite
  // copied from public/ (favicon.svg, robots.txt, …). serveStatic calls next() on a
  // miss, so the fallback below still gets its turn. Scoping this to /assets only would
  // quietly serve index.html in place of a missing favicon.
  app.use('*', serveStatic({ root }))

  const fallback = serveStatic({ root, path: 'index.html' })

  app.get('*', (c, next) => {
    // The /api guard is essential. Without it this fallback answers unmatched API routes
    // with the HTML shell, so a client calling a mistyped endpoint gets a confusing
    // JSON-parse failure instead of the 404 body it expects. Calling next() hands those
    // through to the app's notFound handler.
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return next()
    return fallback(c, next)
  })
}
