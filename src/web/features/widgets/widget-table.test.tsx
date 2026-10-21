import type { Widget } from '@shared/widget'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { WidgetTable } from './widget-table'

/**
 * Component test template.
 *
 * `WidgetTable` renders `<Link>`, so it needs a router in context. A memory-history
 * router is the lightweight way to provide one — no jsdom navigation, no mocking of
 * TanStack Router internals.
 *
 * Note what isn't here: no fetch mocking. The component takes data as a prop, which is
 * why it's testable like this. Keep fetching in routes and hooks, rendering in
 * components.
 */
function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => ui,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  // The cast is needed because `Register` in main.tsx declares the app's router
  // globally, and this throwaway test router isn't it.
  return render(<RouterProvider router={router as never} />)
}

function aWidget(overrides: Partial<Widget> = {}): Widget {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'auth-service',
    status: 'active',
    score: 90,
    lastRefreshedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('WidgetTable', () => {
  it('renders a row per widget', async () => {
    renderWithRouter(
      <WidgetTable
        widgets={[aWidget({ name: 'auth-service' }), aWidget({ name: 'billing-api' })]}
      />,
    )

    expect(await screen.findByText('auth-service')).toBeInTheDocument()
    expect(screen.getByText('billing-api')).toBeInTheDocument()
  })

  it('shows "never" when a widget has not been refreshed', async () => {
    renderWithRouter(<WidgetTable widgets={[aWidget({ lastRefreshedAt: null })]} />)

    expect(await screen.findByText('never')).toBeInTheDocument()
  })

  it('renders an empty state instead of a bare table', async () => {
    renderWithRouter(<WidgetTable widgets={[]} />)

    expect(await screen.findByText(/no widgets match this filter/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
