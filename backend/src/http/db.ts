import { Effect } from 'effect'
import mongoose from 'mongoose'
import { type AppError, Conflict, DatabaseError, ValidationFailed } from './errors.ts'

function isDuplicateKeyError(cause: unknown): cause is { code: 11000; keyValue?: Record<string, unknown> } {
  return typeof cause === 'object' && cause !== null && (cause as { code?: unknown }).code === 11000
}

function toAppError(cause: unknown): AppError {
  if (isDuplicateKeyError(cause)) {
    const field = Object.keys(cause.keyValue ?? {}).at(-1) ?? 'value'
    return new Conflict({
      message: `This ${field} is already in use.`,
      details: [{ field, message: `This ${field} is already in use.` }],
    })
  }
  if (cause instanceof mongoose.Error.ValidationError) {
    const details = Object.values(cause.errors).map(error => ({ field: error.path, message: error.message }))
    return new ValidationFailed({ message: details[0]?.message ?? 'The request is invalid.', details })
  }
  if (cause instanceof mongoose.Error.CastError) {
    return new ValidationFailed({
      message: 'Invalid id.',
      details: [{ field: cause.path, message: 'Invalid id.' }],
    })
  }
  return new DatabaseError({ cause })
}

/** Runs a Mongoose operation inside Effect, translating known driver failures into API errors. */
export const db = <A>(operation: () => PromiseLike<A>): Effect.Effect<A, AppError> =>
  Effect.tryPromise({ try: () => Promise.resolve(operation()), catch: toAppError })
