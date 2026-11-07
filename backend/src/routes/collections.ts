import {
  collectionCreateSchema,
  collectionUpdateSchema,
  dashboardQuerySchema,
  listCollectionsQuerySchema,
  listSentencesQuerySchema,
  pinCollectionSchema,
  sentenceSchema,
} from '@clozera/shared'
import { Effect } from 'effect'
import { Router } from 'express'
import type { Auth } from '../auth/auth.ts'
import { created, handle, noContent, ok, parse } from '../http/handler.ts'
import { currentUser, requireUser } from '../http/session.ts'
import * as collections from '../services/collections-service.ts'

export function collectionsRouter(auth: Auth): Router {
  const router = Router()
  router.use(['/dashboard', '/collections'], requireUser(auth))

  router.get(
    '/dashboard/collections',
    handle(req =>
      Effect.gen(function* () {
        const viewer = yield* currentUser(req)
        const query = yield* parse(dashboardQuerySchema, req.query)
        const result = yield* collections.listDashboardCollections({ viewer, ...query })
        return ok({ collections: result.collections }, result.meta)
      })
    )
  )

  router.post(
    '/dashboard/collections',
    handle(req =>
      Effect.gen(function* () {
        const { collectionId } = yield* parse(pinCollectionSchema, req.body)
        return ok(yield* collections.pinCollection(collectionId, yield* currentUser(req)))
      })
    )
  )

  router.delete(
    '/dashboard/collections/:collectionId',
    handle(req =>
      Effect.gen(function* () {
        const collection = yield* collections.unpinCollection(
          req.params.collectionId,
          yield* currentUser(req)
        )
        return collection ? ok(collection) : noContent
      })
    )
  )

  router.get(
    '/collections',
    handle(req =>
      Effect.gen(function* () {
        const query = yield* parse(listCollectionsQuerySchema, req.query)
        const result = yield* collections.listCollections({ viewer: yield* currentUser(req), ...query })
        return ok({ collections: result.collections }, result.meta)
      })
    )
  )

  router.post(
    '/collections',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(collectionCreateSchema, req.body)
        return created(yield* collections.createCollection(payload, yield* currentUser(req)))
      })
    )
  )

  router.get(
    '/collections/:id',
    handle(req =>
      Effect.gen(function* () {
        return ok(yield* collections.getCollection(req.params.id, yield* currentUser(req)))
      })
    )
  )

  router.patch(
    '/collections/:id',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(collectionUpdateSchema, req.body)
        return ok(yield* collections.updateCollection(req.params.id, payload, yield* currentUser(req)))
      })
    )
  )

  router.delete(
    '/collections/:id',
    handle(req =>
      Effect.gen(function* () {
        yield* collections.deleteCollection(req.params.id, yield* currentUser(req))
        return noContent
      })
    )
  )

  router.get(
    '/collections/:id/sentences',
    handle(req =>
      Effect.gen(function* () {
        const query = yield* parse(listSentencesQuerySchema, req.query)
        const result = yield* collections.listSentences({
          collectionId: req.params.id,
          viewer: yield* currentUser(req),
          query,
        })
        return ok({ sentences: result.sentences }, result.meta)
      })
    )
  )

  router.post(
    '/collections/:id/sentences',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(sentenceSchema, req.body)
        return created(yield* collections.createSentence(req.params.id, payload, yield* currentUser(req)))
      })
    )
  )

  router.patch(
    '/collections/:id/sentences/:sentenceId',
    handle(req =>
      Effect.gen(function* () {
        const payload = yield* parse(sentenceSchema, req.body)
        const viewer = yield* currentUser(req)
        return ok(yield* collections.updateSentence(req.params.id, req.params.sentenceId, payload, viewer))
      })
    )
  )

  router.delete(
    '/collections/:id/sentences/:sentenceId',
    handle(req =>
      Effect.gen(function* () {
        yield* collections.deleteSentence(req.params.id, req.params.sentenceId, yield* currentUser(req))
        return noContent
      })
    )
  )

  return router
}
