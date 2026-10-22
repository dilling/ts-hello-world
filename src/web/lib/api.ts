import type { AppType } from '@server/app'
import { hc } from 'hono/client'

/**
 * Typed RPC client against the server's own route type. See src/web/README.md.
 *
 * `AppType` must stay a type-only import — a value import from @server would pull
 * Postgres into the browser bundle.
 */
export const api = hc<AppType>('/').api

/** The minimum a response needs for `unwrap` — satisfied by Hono's ClientResponse. */
interface UnwrappableResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/**
 * Drops the failure variants from a route's union response type, leaving the success body.
 *
 * `Exclude<R, { ok: false }>` and not `Extract<R, { ok: true }>`: a handler that returns
 * `c.json(x)` with no explicit status widens to `ok: boolean`, matching neither.
 */
type SuccessResponse<R> = Exclude<R, { ok: false }>
type SuccessBody<R> = SuccessResponse<R> extends { json: () => Promise<infer Body> } ? Body : never

export async function unwrap<R extends UnwrappableResponse>(response: R): Promise<SuccessBody<R>> {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  return (await response.json()) as SuccessBody<R>
}

/**
 * For routes that return `204 No Content` — `DELETE /widgets/:id`, for example.
 *
 * Don't reach for `unwrap` there: it always calls `.json()`, and parsing an empty body
 * throws a `SyntaxError` *after* the request already succeeded. You'd see a mutation
 * report failure for a delete that actually worked.
 */
export async function unwrapEmpty(response: UnwrappableResponse): Promise<void> {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
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
