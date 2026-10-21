import type { AppType } from '@server/app'
import { hc } from 'hono/client'

/**
 * The typed RPC client. `AppType` is the *server's* route type, imported directly —
 * no codegen, no OpenAPI spec, no duplicated types. Rename a field in a route handler
 * and `npm run typecheck` fails here.
 *
 * Only the type is imported, so none of the server's runtime code reaches the bundle.
 * Keep it that way: a value import from @server would pull Postgres into the browser.
 */
export const api = hc<AppType>('/').api

/** The minimum a response needs for `unwrap` — satisfied by Hono's ClientResponse. */
interface UnwrappableResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/**
 * A Hono route that can return an error has a UNION response type (the 200 body OR the
 * 400 body), so `(await res.json()).widgets` doesn't typecheck — the error variant has
 * no `widgets`. This drops the failure variants from the union, leaving the success
 * body, and converts errors into thrown exceptions so TanStack Query's `isError` and
 * React error boundaries behave.
 *
 * `Exclude<R, { ok: false }>` rather than `Extract<R, { ok: true }>` on purpose: a
 * handler that returns `c.json(x)` without an explicit status widens to
 * `ok: boolean`, which matches neither `true` nor `false` — so excluding the known
 * failures is what keeps those routes usable.
 */
type SuccessResponse<R> = Exclude<R, { ok: false }>
type SuccessBody<R> = SuccessResponse<R> extends { json: () => Promise<infer Body> } ? Body : never

export async function unwrap<R extends UnwrappableResponse>(response: R): Promise<SuccessBody<R>> {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  return (await response.json()) as SuccessBody<R>
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function readErrorMessage(response: UnwrappableResponse): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return body.error?.message ?? `Request failed with ${response.status}`
  } catch {
    return `Request failed with ${response.status}`
  }
}
