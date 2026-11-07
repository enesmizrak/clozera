import { profileUpdateSchema } from '@clozera/shared'
import { Effect } from 'effect'
import { Router } from 'express'
import type { Auth } from '../auth/auth.ts'
import { handle, ok, parse } from '../http/handler.ts'
import { currentUser, requireUser, sessionUser } from '../http/session.ts'
import * as users from '../services/users-service.ts'

export function usersRouter(auth: Auth): Router {
  const router = Router()

  /** The signed-in learner's profile, or `null` when signed out. Never responds 401. */
  router.get(
    '/session',
    handle(req =>
      Effect.gen(function* () {
        const user = yield* sessionUser(auth, req)
        return ok(user ? yield* users.getProfile(user) : null)
      })
    )
  )

  router.get(
    '/users/me',
    requireUser(auth),
    handle(req =>
      Effect.gen(function* () {
        return ok(yield* users.getProfile(yield* currentUser(req)))
      })
    )
  )

  router.patch(
    '/users/me',
    requireUser(auth),
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(profileUpdateSchema, req.body)
        return ok(yield* users.updateProfile(yield* currentUser(req), payload))
      })
    )
  )

  return router
}
