import type { CreateWidgetInput, UpdateWidgetInput, Widget } from '@shared/widget'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, unwrap, unwrapEmpty } from './api'
import { invalidateWidgets } from './queries'

/**
 * The write side; `queries.ts` reads. Every mutation unwraps, invalidates, and toasts both
 * outcomes — a `useMutation` with no `onError` fails silently. See src/web/README.md.
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

/** Refresh-now. Returns a count rather than a widget, so the toast differs. */
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
