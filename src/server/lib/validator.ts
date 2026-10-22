import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { type ZodType, z } from 'zod'

/**
 * Use this instead of `zValidator` directly. Bare zValidator responds with its own
 * `{ success: false, error: ZodError }` body and never reaches `app.onError`, making
 * validation the one error shape in the API that doesn't match the rest.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'validation_failed',
            // prettifyError gives a readable multi-line summary instead of raw issue JSON.
            message: z.prettifyError(result.error),
          },
        },
        400,
      )
    }
    return undefined
  })
}
