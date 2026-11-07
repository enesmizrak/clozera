import { Effect } from 'effect'
import { Types } from 'mongoose'
import type { AppError } from '../http/errors.ts'

/** Parses a route id; malformed ids fail with the caller's not-found error instead of a cast error. */
export function objectId(value: unknown, notFound: () => AppError): Effect.Effect<Types.ObjectId, AppError> {
  return typeof value === 'string' && Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value)
    ? Effect.succeed(new Types.ObjectId(value))
    : Effect.fail(notFound())
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
