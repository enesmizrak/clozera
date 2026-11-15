import { COLLECTION_TYPES, normalizeSentencePayload } from '@clozera/shared'
import { Effect } from 'effect'
import { z } from 'zod'
import { db } from '../http/db.ts'
import { NotFound, ValidationFailed, collectionNotFound, languagePairNotFound } from '../http/errors.ts'
import { objectId } from '../lib/ids.ts'
import { Collection } from '../models/collection.ts'
import { CollectionGroup } from '../models/collection-group.ts'
import { CollectionSentence } from '../models/collection-sentence.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import type { UserDocument } from '../models/user.ts'
import { nextSentenceOrder, refreshSentenceCount } from './collections-service.ts'

/** Admin import payloads. Official content is owned by the importing admin. */
export const languagesImportSchema = z.object({
  languages: z
    .array(
      z.object({
        code: z.string().trim().min(2),
        iso3: z.string().trim().length(3),
        name: z.string().trim().min(1),
        nativeName: z.string().trim().min(1),
        flagIso: z.string().trim().min(2),
        rtl: z.boolean().optional(),
        ttsLocale: z.string().trim().optional(),
      })
    )
    .default([]),
})

const languageReference = z.string().trim().min(2)
export const languagePairsImportSchema = z.object({
  languagePairs: z
    .array(
      z
        .object({
          slug: z.string().trim().min(1),
          name: z.string().trim().min(1),
          targetLanguageIso3: languageReference.optional(),
          targetLanguageCode: languageReference.optional(),
          baseLanguageIso3: languageReference.optional(),
          baseLanguageCode: languageReference.optional(),
          active: z.boolean().default(true),
          totalSentences: z.number().int().min(0).default(0),
        })
        .refine(pair => pair.targetLanguageIso3 ?? pair.targetLanguageCode, 'A target language is required.')
        .refine(pair => pair.baseLanguageIso3 ?? pair.baseLanguageCode, 'A base language is required.')
    )
    .default([]),
})

export const collectionsImportSchema = z.object({
  languagePairSlug: z.string().trim().min(1),
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        type: z.string().trim().min(1),
        description: z.string().default(''),
        order: z.number().default(0),
      })
    )
    .default([]),
  collections: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        slug: z.string().trim().min(1),
        description: z.string().default(''),
        type: z.enum(COLLECTION_TYPES).default('fast_track'),
        level: z.string().default(''),
        groupType: z.string().optional(),
        isOfficial: z.boolean().default(true),
        isPublic: z.boolean().default(true),
        order: z.number().default(0),
      })
    )
    .default([]),
})

export const sentencesImportSchema = z.object({
  sentences: z
    .array(
      z.looseObject({
        text: z.string(),
        translation: z.string(),
        order: z.number().optional(),
      })
    )
    .default([]),
})

const findLanguage = (identifier: string) =>
  db(() => Language.findOne({ $or: [{ iso3: identifier }, { code: identifier }] })).pipe(
    Effect.flatMap(language =>
      language
        ? Effect.succeed(language)
        : Effect.fail(
            new NotFound({ message: `Language not found: ${identifier}`, code: 'LANGUAGE_NOT_FOUND' })
          )
    )
  )

export const importLanguages = (input: z.output<typeof languagesImportSchema>) =>
  db(() => Language.insertMany(input.languages, { ordered: false }))

export const importLanguagePairs = Effect.fn('importLanguagePairs')(function* (
  input: z.output<typeof languagePairsImportSchema>
) {
  const created = []
  for (const pair of input.languagePairs) {
    const [targetLanguage, baseLanguage] = yield* Effect.all([
      findLanguage((pair.targetLanguageIso3 ?? pair.targetLanguageCode)!),
      findLanguage((pair.baseLanguageIso3 ?? pair.baseLanguageCode)!),
    ])
    created.push(
      yield* db(() =>
        LanguagePair.create({
          slug: pair.slug,
          name: pair.name,
          active: pair.active,
          totalSentences: pair.totalSentences,
          targetLanguage: targetLanguage._id,
          baseLanguage: baseLanguage._id,
        })
      )
    )
  }
  return created
})

export const importCollections = Effect.fn('importCollections')(function* (
  input: z.output<typeof collectionsImportSchema>,
  owner: UserDocument
) {
  const pair = yield* db(() => LanguagePair.findOne({ slug: input.languagePairSlug }))
  if (!pair) return yield* languagePairNotFound()

  const groups = yield* db(() =>
    CollectionGroup.insertMany(input.groups.map(group => ({ ...group, languagePair: pair._id })))
  )
  const groupByType = new Map(groups.map(group => [group.type, group._id]))
  const collections = yield* db(() =>
    Collection.insertMany(
      input.collections.map(({ groupType, ...collection }) => ({
        ...collection,
        owner: owner._id,
        languagePair: pair._id,
        group: groupType ? (groupByType.get(groupType) ?? null) : null,
      }))
    )
  )
  return { groups, collections }
})

export const importCollectionSentences = Effect.fn('importCollectionSentences')(function* (
  collectionIdValue: unknown,
  input: z.output<typeof sentencesImportSchema>,
  owner: UserDocument
) {
  const _id = yield* objectId(collectionIdValue, collectionNotFound)
  const collection = yield* db(() => Collection.findById(_id))
  if (!collection) return yield* collectionNotFound()

  const base = yield* nextSentenceOrder(collection._id)
  const documents: Array<ReturnType<typeof normalizeSentencePayload> & Record<string, unknown>> = []
  for (const [index, sentence] of input.sentences.entries()) {
    const normalized = normalizeSentencePayload(sentence)
    if (!normalized.cloze) {
      const message = 'Sentence text must contain exactly one non-empty cloze marker.'
      return yield* new ValidationFailed({
        message,
        details: [{ field: `sentences.${index}.text`, message }],
      })
    }
    documents.push({
      ...normalized,
      owner: owner._id,
      collection: collection._id,
      order: base + (sentence.order ?? index),
    })
  }

  const created = yield* db(() => CollectionSentence.insertMany(documents))
  yield* refreshSentenceCount(collection._id)
  return created
})
