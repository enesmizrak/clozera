import type { ApiErrorBody, ApiFieldIssue } from '@clozera/shared'
import { Data } from 'effect'
import type { z } from 'zod'

/** Expected failures. Each one maps to a stable HTTP status and API error code. */
export class NotFound extends Data.TaggedError('NotFound')<{ message: string; code?: string }> {}
export class Forbidden extends Data.TaggedError('Forbidden')<{ message: string }> {}
export class Unauthenticated extends Data.TaggedError('Unauthenticated')<{}> {}
export class Conflict extends Data.TaggedError('Conflict')<{ message: string; details?: ApiFieldIssue[] }> {}
export class ValidationFailed extends Data.TaggedError('ValidationFailed')<{
  message: string
  details: ApiFieldIssue[]
  code?: string
}> {}
/** An unexpected database failure. Reported as a 500 without leaking driver details. */
export class DatabaseError extends Data.TaggedError('DatabaseError')<{ cause: unknown }> {}

export type AppError = NotFound | Forbidden | Unauthenticated | Conflict | ValidationFailed | DatabaseError

export const collectionNotFound = () => new NotFound({ message: 'Collection not found.' })
export const languagePairNotFound = (message = 'Language pair not found.') =>
  new NotFound({ message, code: 'LANGUAGE_PAIR_NOT_FOUND' })

export function validationFailed(error: z.ZodError, message = 'The request is invalid.'): ValidationFailed {
  const details = error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }))
  return new ValidationFailed({ message: details[0]?.message ?? message, details })
}

export function errorResponse(
  error: AppError,
  isProduction: boolean
): { status: number; body: ApiErrorBody } {
  const body = (status: number, code: string, message: string, details: ApiFieldIssue[] = []) => ({
    status,
    body: { error: { code, message, details } },
  })

  switch (error._tag) {
    case 'NotFound':
      return body(404, error.code ?? 'NOT_FOUND', error.message)
    case 'Forbidden':
      return body(403, 'FORBIDDEN', error.message)
    case 'Unauthenticated':
      return body(401, 'UNAUTHENTICATED', 'Authentication is required.')
    case 'Conflict':
      return body(409, 'CONFLICT', error.message, error.details)
    case 'ValidationFailed':
      return body(400, error.code ?? 'VALIDATION_ERROR', error.message, error.details)
    case 'DatabaseError':
      return body(
        500,
        'INTERNAL_SERVER_ERROR',
        isProduction ? 'Unexpected server error.' : String((error.cause as Error)?.message ?? error.cause)
      )
  }
}
