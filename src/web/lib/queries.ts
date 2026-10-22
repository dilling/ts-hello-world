import type { ListWidgetsQuery, WidgetStatus } from '@shared/widget'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { api, unwrap } from './api'

/** Two-tier state; no global store. See src/web/README.md. */
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
