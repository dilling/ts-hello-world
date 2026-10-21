import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
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
            className="text-muted-foreground text-sm hover:text-foreground [&.active]:text-foreground"
          >
            Widgets
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
