import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { AppError } from '@web/components/app-error'
import { AppNotFound } from '@web/components/app-not-found'
import { AppPending } from '@web/components/app-pending'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dashboard data is refreshed by a background job every few minutes, so a short
      // stale time avoids hammering the API on every navigation without going stale.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createRouter({
  routeTree,
  // `context` is how route loaders get the query client — see routes/widgets.index.tsx.
  context: { queryClient },
  defaultPreload: 'intent',

  /*
   * These three defaults are the app's safety net, and they're set here rather than
   * per-route on purpose: a new route file inherits all of them for free, so nobody has
   * to remember.
   *
   * Without them, every route that fetches with `useSuspenseQuery` — which is all of
   * them — fails *invisibly*. The query throws, the route unmounts, and TanStack falls
   * back to its own minimal renderer, which reads as "the app died". A failed API call
   * should look like a failed API call.
   */
  defaultErrorComponent: AppError,
  defaultPendingComponent: AppPending,
  defaultNotFoundComponent: AppNotFound,
  // Don't flash a spinner for a fast loader; show one promptly when it isn't.
  defaultPendingMs: 300,
  defaultPendingMinMs: 400,
})

// Makes `Link to="..."` and `useSearch()` type-safe across the whole app.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root not found in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
