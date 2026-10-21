import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Domain errors. Services throw these; they know nothing about HTTP beyond the status
 * code hint, and a single `app.onError` handler in app.ts turns them into responses.
 * That keeps error shaping in one place instead of try/catch in every route.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: ContentfulStatusCode,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' was not found`, 'not_found', 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'conflict', 409)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'validation_failed', 400)
  }
}

/** The body shape every error response uses. */
export interface ErrorBody {
  error: {
    code: string
    message: string
  }
}

export function toErrorBody(error: AppError): ErrorBody {
  return { error: { code: error.code, message: error.message } }
}
