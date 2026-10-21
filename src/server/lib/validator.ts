import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { type ZodType, z } from 'zod'

/**
 * Use this instead of `zValidator` directly.
 *
 * Out of the box zValidator responds with its own `{ success: false, error: ZodError }`
 * body and never reaches `app.onError`, so validation failures would be the one error
 * shape in the API that doesn't match the others. This wrapper supplies the error hook
 * so every failure — validation, domain, unexpected — comes back as
 * `{ error: { code, message } }`.
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
