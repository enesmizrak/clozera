import { Effect } from 'effect'
import { db } from '../http/db.ts'
import { serializeLanguage, serializeLanguagePair } from '../lib/serializers.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'

export const listLanguages = db(() => Language.find().sort({ name: 1 }).lean()).pipe(
  Effect.map(languages => languages.map(serializeLanguage))
)

export const listLanguagePairs = db(() =>
  LanguagePair.find({ active: true }).populate(['targetLanguage', 'baseLanguage']).sort({ name: 1 }).lean()
).pipe(Effect.map(pairs => pairs.map(pair => serializeLanguagePair(pair as never))))
