import { Effect } from 'effect'
import { Router } from 'express'
import { handle, ok } from '../http/handler.ts'
import { listLanguagePairs, listLanguages } from '../services/languages-service.ts'

export function languagesRouter(): Router {
  const router = Router()
  router.get(
    '/languages',
    handle(() => Effect.map(listLanguages, ok))
  )
  router.get(
    '/language-pairs',
    handle(() => Effect.map(listLanguagePairs, ok))
  )
  return router
}
