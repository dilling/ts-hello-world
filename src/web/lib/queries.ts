import type { ListWidgetsQuery, WidgetStatus } from '@shared/widget'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

/**
 * PATTERN: frontend state has exactly two tiers.
 *
 *   1. Server-derived data -> TanStack Query (this file).
 *   2. Ephemeral UI state  -> useState in the component that owns it.
 *
 * There is deliberately NO Redux / Zustand / global store. Nearly all state in a
 * dashboard like this is a cached copy of server data, and Query already handles
 * caching, refetching, dedup, and invalidation. Please don't add one at 2am; if you
 * genuinely need cross-route client state (a wizard, say), reach for a React context
 * first and bring it up with the team.
 *
 * `queryOptions` keeps the key and the fetcher in one object, so a key can never drift
 * from its query. The same object is reusable in a route loader, a `useQuery`, and a
 * `queryClient.invalidateQueries` call.
 */
export const widgetQueries = {
  all: () => ['widgets'] as const,

  list: (filter: ListWidgetsQuery = {}) =>
    queryOptions({
      queryKey: [...widgetQueries.all(), 'list', filter] as const,
      queryFn: async () => {
        const { widgets } = await unwrap(await api.widgets.$get({ query: toQueryParams(filter) }))
        return widgets
      },
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: [...widgetQueries.all(), 'detail', id] as const,
      queryFn: async () => {
        const { widget } = await unwrap(await api.widgets[':id'].$get({ param: { id } }))
        return widget
      },
    }),
}

/** Invalidate everything widget-shaped — call after any mutation. */
export function invalidateWidgets(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: widgetQueries.all() })
}

/**
 * The RPC client sends query params as strings, so numbers need stringifying and
 * `undefined` keys need dropping (otherwise they'd serialize as "undefined").
 */
function toQueryParams(filter: ListWidgetsQuery): {
  status?: WidgetStatus
  minScore?: string
} {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.minScore !== undefined ? { minScore: String(filter.minScore) } : {}),
  }
}
