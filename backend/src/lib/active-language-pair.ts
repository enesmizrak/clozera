import { Effect } from 'effect'
import { db } from '../http/db.ts'
import { type AppError, languagePairNotFound } from '../http/errors.ts'
import { LanguagePair, type LanguagePairDocument } from '../models/language-pair.ts'
import type { UserDocument } from '../models/user.ts'
import { refId } from './refs.ts'

export function findActiveLanguagePair(slug: string): Effect.Effect<LanguagePairDocument, AppError> {
  return db(() => LanguagePair.findOne({ slug, active: true })).pipe(
    Effect.flatMap(pair => (pair ? Effect.succeed(pair) : Effect.fail(languagePairNotFound())))
  )
}

/** The learner's selected pair when it is still active, otherwise the first active pair by name. */
export function resolveActiveLanguagePair(user: UserDocument): Effect.Effect<LanguagePairDocument, AppError> {
  return Effect.gen(function* () {
    const selectedId = refId(user.selectedLanguagePair)
    if (selectedId) {
      const selected = yield* db(() => LanguagePair.findById(selectedId))
      if (selected?.active) return selected
    }
    const fallback = yield* db(() => LanguagePair.findOne({ active: true }).sort({ name: 1 }))
    return fallback ?? (yield* Effect.fail(languagePairNotFound('No active language pair is available.')))
  })
}
