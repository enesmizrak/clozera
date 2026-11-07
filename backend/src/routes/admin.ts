import { Effect } from 'effect'
import { Router } from 'express'
import type { Auth } from '../auth/auth.ts'
import { created, handle, parse } from '../http/handler.ts'
import { currentUser, requireAdmin } from '../http/session.ts'
import * as admin from '../services/admin-service.ts'

export function adminRouter(auth: Auth): Router {
  const router = Router()
  router.use('/admin', requireAdmin(auth))

  router.post(
    '/admin/languages/import',
    handle(req =>
      Effect.gen(function* () {
        return created(yield* admin.importLanguages(yield* parse(admin.languagesImportSchema, req.body)))
      })
    )
  )

  router.post(
    '/admin/language-pairs/import',
    handle(req =>
      Effect.gen(function* () {
        return created(
          yield* admin.importLanguagePairs(yield* parse(admin.languagePairsImportSchema, req.body))
        )
      })
    )
  )

  router.post(
    '/admin/collections/import',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(admin.collectionsImportSchema, req.body)
        return created(yield* admin.importCollections(payload, yield* currentUser(req)))
      })
    )
  )

  router.post(
    '/admin/collections/:id/sentences/import',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(admin.sentencesImportSchema, req.body)
        return created(
          yield* admin.importCollectionSentences(req.params.id, payload, yield* currentUser(req))
        )
      })
    )
  )

  return router
}
