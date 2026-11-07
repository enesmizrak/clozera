import type { ProfileUpdateInput } from '@clozera/shared'
import { Effect } from 'effect'
import { db } from '../http/db.ts'
import { NotFound } from '../http/errors.ts'
import { findActiveLanguagePair } from '../lib/active-language-pair.ts'
import { serializeUser } from '../lib/serializers.ts'
import { User, type UserDocument } from '../models/user.ts'

const PROFILE_PATHS = ['selectedLanguagePair', 'languagePairs']

export const getProfile = Effect.fn('getProfile')(function* (user: UserDocument) {
  yield* db(() => user.populate(PROFILE_PATHS))
  return serializeUser(user)
})

export const updateProfile = Effect.fn('updateProfile')(function* (
  user: UserDocument,
  payload: ProfileUpdateInput
) {
  const { selectedLanguagePairSlug, ...fields } = payload
  const update: Record<string, unknown> = { $set: { ...fields } }

  if (selectedLanguagePairSlug !== undefined) {
    const pair = yield* findActiveLanguagePair(selectedLanguagePairSlug)
    ;(update.$set as Record<string, unknown>).selectedLanguagePair = pair._id
    update.$addToSet = { languagePairs: pair._id }
  }
  if (fields.username !== undefined)
    (update.$set as Record<string, unknown>).displayUsername = fields.username

  const updated = yield* db(() =>
    User.findByIdAndUpdate(user._id, update, { returnDocument: 'after', runValidators: true }).populate(
      PROFILE_PATHS
    )
  )
  return updated ? serializeUser(updated) : yield* new NotFound({ message: 'User not found.' })
})
