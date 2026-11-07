import { fromNodeHeaders } from 'better-auth/node'
import { Effect } from 'effect'
import type { Request } from 'express'
import type { Auth } from '../auth/auth.ts'
import { User, type UserDocument } from '../models/user.ts'
import { db } from './db.ts'
import { type AppError, Forbidden, Unauthenticated } from './errors.ts'
import { step } from './handler.ts'

declare global {
  namespace Express {
    interface Request {
      /** The signed-in learner, attached by `requireUser` or `requireAdmin`. */
      user?: UserDocument
    }
  }
}

/** Resolves the Better Auth session cookie to the learner's Mongoose document, or null when signed out. */
export function sessionUser(auth: Auth, req: Request): Effect.Effect<UserDocument | null, AppError> {
  return Effect.gen(function* () {
    const session = yield* db(() => auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))
    if (!session) return null
    return yield* db(() => User.findById(session.user.id))
  })
}

/** The learner attached by an auth guard. Fails when a route is missing its guard. */
export const currentUser = (req: Request): Effect.Effect<UserDocument, AppError> =>
  req.user ? Effect.succeed(req.user) : Effect.fail(new Unauthenticated())

export const requireUser = (auth: Auth) =>
  step(req =>
    Effect.gen(function* () {
      const user = yield* sessionUser(auth, req)
      if (!user) return yield* new Unauthenticated()
      req.user = user
    })
  )

export const requireAdmin = (auth: Auth) =>
  step(req =>
    Effect.gen(function* () {
      const user = yield* sessionUser(auth, req)
      if (!user) return yield* new Unauthenticated()
      if (user.role !== 'admin') return yield* new Forbidden({ message: 'Admin privileges are required.' })
      req.user = user
    })
  )
