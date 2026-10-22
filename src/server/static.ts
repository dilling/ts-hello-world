import { serveStatic } from '@hono/node-server/serve-static'
import type { Hono } from 'hono'

/** Just the bits of a Hono app this needs, so the caller's chained route type survives. */
type Mountable = Pick<Hono, 'use' | 'get'>

/** Serves the built SPA from `root` alongside the API. */
export function mountSpa(app: Mountable, root: string): void {
  // Matches `*` and not `/assets/*`: Vite also copies public/ to the root, so narrowing
  // this would serve index.html in place of a missing favicon. serveStatic calls next()
  // on a miss, so the fallback below still gets its turn.
  app.use('*', serveStatic({ root }))

  const fallback = serveStatic({ root, path: 'index.html' })

  app.get('*', (c, next) => {
    // Without the /api guard, a mistyped endpoint gets the HTML shell and fails to
    // JSON-parse instead of returning the 404 body. next() reaches notFound.
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return next()
    return fallback(c, next)
  })
}
