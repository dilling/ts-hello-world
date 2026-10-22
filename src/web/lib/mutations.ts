import type { CreateWidgetInput, UpdateWidgetInput, Widget } from '@shared/widget'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, unwrap, unwrapEmpty } from './api'
import { invalidateWidgets } from './queries'

/**
 * PATTERN: the write side. `queries.ts` reads, this file writes.
 *
 * Every mutation in the app is a hook in a file like this one, and every one does the
 * same four things in the same order:
 *
 *   1. call the typed RPC client through `unwrap` (or `unwrapEmpty` for a 204),
 *   2. invalidate the queries the write invalidated,
 *   3. say something on success,
 *   4. say something on failure.
 *
 * Steps 3 and 4 are the ones people skip. A `useMutation` with no `onError` fails
 * *silently* — the request 500s, nothing changes on screen, and the next twenty minutes
 * go into debugging the wrong layer. `reportError` is the floor; override `onError` if a
 * mutation needs to do more.
 *
 * Deliberately NOT here: optimistic updates. They need a cancel + snapshot + rollback
 * dance in `onMutate`/`onError` and they are not worth it on a list that refetches in
 * under 100ms. Add one only where a human can actually feel the latency.
 */

/** Default failure handling: surface the server's message, don't swallow it. */
function reportError(error: unknown): void {
  toast.error(error instanceof Error ? error.message : 'Something went wrong')
}

export function useCreateWidget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWidgetInput): Promise<Widget> => {
      const { widget } = await unwrap(await api.widgets.$post({ json: input }))
      return widget
    },
    onSuccess: async (widget) => {
      toast.success(`Created ${widget.name}`)
      await invalidateWidgets(queryClient)
    },
    onError: reportError,
  })
}

export function useUpdateWidget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { id: string; patch: UpdateWidgetInput }): Promise<Widget> => {
      const { widget } = await unwrap(
        await api.widgets[':id'].$patch({ param: { id: vars.id }, json: vars.patch }),
      )
      return widget
    },
    onSuccess: async (widget) => {
      toast.success(`Saved ${widget.name}`)
      await invalidateWidgets(queryClient)
    },
    onError: reportError,
  })
}

export function useDeleteWidget() {
  const queryClient = useQueryClient()

  return useMutation({
    // 204, so `unwrapEmpty` — see the note on it in `api.ts`.
    mutationFn: async (id: string) =>
      unwrapEmpty(await api.widgets[':id'].$delete({ param: { id } })),
    onSuccess: async () => {
      toast.success('Widget deleted')
      await invalidateWidgets(queryClient)
    },
    onError: reportError,
  })
}

/**
 * Refresh-now. Returns a count rather than a widget, which is why it doesn't follow the
 * shape above exactly — the toast reports how many rows the job touched.
 */
export function useRefreshWidgets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { refreshed } = await unwrap(await api.widgets.refresh.$post())
      return refreshed
    },
    onSuccess: async (refreshed) => {
      toast.success(refreshed === 1 ? 'Refreshed 1 widget' : `Refreshed ${refreshed} widgets`)
      await invalidateWidgets(queryClient)
    },
    onError: reportError,
  })
}
