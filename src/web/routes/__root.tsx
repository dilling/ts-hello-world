import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@web/components/ui/sonner'
import { Boxes } from 'lucide-react'

/**
 * The root route also declares the router's context type, which is what makes
 * `context.queryClient` typed inside every loader in this app.
 */
export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Boxes className="text-primary" />
            Repo Quality
          </Link>
          <Link
            to="/widgets"
            className="text-muted-foreground hover:text-foreground text-sm [&.active]:text-foreground"
          >
            Widgets
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>

      {/* Mounted once, app-wide. Every mutation reports through this — see lib/mutations.ts. */}
      <Toaster position="bottom-right" />

      {/*
       * Both devtools panels, dev-only. `import.meta.env.DEV` is statically false in a
       * production build, so Rolldown drops these and their imports from the bundle.
       *
       * Please actually use them. The Query panel shows every cache entry, its key and
       * its freshness, which answers "why is this showing stale data" in two seconds —
       * that question otherwise turns into twenty minutes of reading generated code
       * looking for a bug that is really just a query key.
       */}
      {import.meta.env.DEV ? (
        <>
          <ReactQueryDevtools buttonPosition="bottom-left" />
          <TanStackRouterDevtools position="top-right" />
        </>
      ) : null}
    </div>
  )
}
