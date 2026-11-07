import {
  type CollectionDto,
  type PageMeta,
  type SentenceDto,
  type SentencePayload,
  type collectionCreateSchema,
  type collectionUpdateSchema,
  type listSentencesQuerySchema,
} from '@clozera/shared'
import { Effect } from 'effect'
import type { Types } from 'mongoose'
import type { z } from 'zod'
import { db } from '../http/db.ts'
import { type AppError, Forbidden, NotFound, ValidationFailed, collectionNotFound } from '../http/errors.ts'
import { findActiveLanguagePair, resolveActiveLanguagePair } from '../lib/active-language-pair.ts'
import { collectionAccessConditions, pinnedCollectionIds } from '../lib/collection-capabilities.ts'
import { escapeRegex, objectId } from '../lib/ids.ts'
import { serializeCollection, serializeSentence } from '../lib/serializers.ts'
import { Collection, type CollectionDocument } from '../models/collection.ts'
import { CollectionSentence } from '../models/collection-sentence.ts'
import type { CollectionGroupFields } from '../models/collection-group.ts'
import { User, type UserDocument } from '../models/user.ts'

const POPULATED_PATHS = ['languagePair', 'group', 'owner']

const collectionId = (id: unknown) => objectId(id, collectionNotFound)

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function groupOrder(collection: CollectionDocument): number {
  const group = collection.group as unknown as CollectionGroupFields | null
  return group?.order ?? Number.MAX_SAFE_INTEGER
}

function findAccessibleCollection(id: Types.ObjectId, viewer: UserDocument) {
  return db(() =>
    Collection.findOne({ _id: id, $or: collectionAccessConditions(viewer) }).populate(POPULATED_PATHS)
  ).pipe(
    Effect.flatMap(collection =>
      collection ? Effect.succeed(collection) : Effect.fail(collectionNotFound())
    )
  )
}

/** Loads a collection the viewer may change: their own, non-official collections. */
function findOwnedCollection(id: unknown, viewer: UserDocument): Effect.Effect<CollectionDocument, AppError> {
  return Effect.gen(function* () {
    const _id = yield* collectionId(id)
    const collection = yield* db(() => Collection.findOne({ _id, owner: viewer._id, isOfficial: false }))
    if (collection) return collection
    const exists = yield* db(() => Collection.exists({ _id }))
    return yield* exists
      ? Effect.fail(new Forbidden({ message: 'Only the collection owner can change this collection.' }))
      : Effect.fail(collectionNotFound())
  })
}

/** Picks `base`, or the next free `base-N` slug within a language pair, using a single query. */
function uniqueCollectionSlug(languagePair: Types.ObjectId, base: string) {
  return db(() =>
    Collection.find({ languagePair, slug: new RegExp(`^${escapeRegex(base)}(-\\d+)?$`) }, { slug: 1 }).lean()
  ).pipe(
    Effect.map(existing => {
      const taken = new Set(existing.map(collection => collection.slug))
      if (!taken.has(base)) return base
      let suffix = 2
      while (taken.has(`${base}-${suffix}`)) suffix += 1
      return `${base}-${suffix}`
    })
  )
}

export const listCollections = Effect.fn('listCollections')(function* (input: {
  viewer: UserDocument
  languagePair?: string | undefined
  owner?: 'me' | undefined
  page: number
  perPage: number
}) {
  const filters: Record<string, unknown> = {}
  if (input.languagePair) filters.languagePair = (yield* findActiveLanguagePair(input.languagePair))._id
  if (input.owner === 'me') filters.owner = input.viewer._id
  else filters.$or = collectionAccessConditions(input.viewer)

  const [total, collections] = yield* Effect.all(
    [
      db(() => Collection.countDocuments(filters)),
      db(() =>
        Collection.find(filters)
          .populate(POPULATED_PATHS)
          .sort({ order: 1, _id: 1 })
          .skip((input.page - 1) * input.perPage)
          .limit(input.perPage)
      ),
    ],
    { concurrency: 'unbounded' }
  )

  const sorted = collections.toSorted(
    (left, right) => groupOrder(left) - groupOrder(right) || (left.order ?? 0) - (right.order ?? 0)
  )

  return {
    collections: sorted.map(collection => serializeCollection(collection, input.viewer)),
    meta: { total, page: input.page, perPage: input.perPage } satisfies PageMeta,
  }
})

export const getCollection = Effect.fn('getCollection')(function* (id: unknown, viewer: UserDocument) {
  const collection = yield* findAccessibleCollection(yield* collectionId(id), viewer)
  return serializeCollection(collection, viewer)
})

export const createCollection = Effect.fn('createCollection')(function* (
  payload: z.output<typeof collectionCreateSchema>,
  viewer: UserDocument
) {
  const baseSlug = slugify(payload.name)
  if (!baseSlug) {
    return yield* new ValidationFailed({
      message: 'Collection name must contain letters or numbers.',
      details: [{ field: 'name', message: 'Collection name must contain letters or numbers.' }],
    })
  }

  const pair = payload.languagePairSlug
    ? yield* findActiveLanguagePair(payload.languagePairSlug)
    : yield* resolveActiveLanguagePair(viewer)
  const slug = yield* uniqueCollectionSlug(pair._id, baseSlug)

  const collection = yield* db(() =>
    Collection.create({
      owner: viewer._id,
      languagePair: pair._id,
      name: payload.name,
      slug,
      description: payload.description,
      type: payload.type,
      level: payload.level,
      isOfficial: false,
      isPublic: payload.visibility === 'public',
    })
  )

  // New My Collections are pinned to the creator's dashboard automatically.
  const updatedViewer = yield* db(() =>
    User.findByIdAndUpdate(
      viewer._id,
      { $addToSet: { pinnedCollections: collection._id } },
      { returnDocument: 'after' }
    )
  )
  yield* db(() => collection.populate(POPULATED_PATHS))
  return serializeCollection(collection, updatedViewer ?? viewer)
})

export const updateCollection = Effect.fn('updateCollection')(function* (
  id: unknown,
  payload: z.output<typeof collectionUpdateSchema>,
  viewer: UserDocument
) {
  const collection = yield* findOwnedCollection(id, viewer)
  if (payload.name !== undefined) collection.name = payload.name
  if (payload.description !== undefined) collection.description = payload.description
  if (payload.visibility !== undefined) collection.isPublic = payload.visibility === 'public'

  yield* db(() => collection.save())
  yield* db(() => collection.populate(POPULATED_PATHS))
  return serializeCollection(collection, viewer)
})

export const deleteCollection = Effect.fn('deleteCollection')(function* (id: unknown, viewer: UserDocument) {
  const collection = yield* findOwnedCollection(id, viewer)
  yield* db(() => CollectionSentence.deleteMany({ collection: collection._id }))
  yield* db(() => Collection.deleteOne({ _id: collection._id }))
  yield* db(() =>
    User.updateMany({ pinnedCollections: collection._id }, { $pull: { pinnedCollections: collection._id } })
  )
})

export const listDashboardCollections = Effect.fn('listDashboardCollections')(function* (input: {
  viewer: UserDocument
  languagePair?: string | undefined
}) {
  const pinnedIds = [...pinnedCollectionIds(input.viewer)]
  const empty = {
    collections: [] as CollectionDto[],
    meta: { total: 0, page: 1, perPage: 0 } satisfies PageMeta,
  }
  if (pinnedIds.length === 0) return empty

  const filters: Record<string, unknown> = {
    _id: { $in: pinnedIds },
    $or: collectionAccessConditions(input.viewer),
  }
  if (input.languagePair) filters.languagePair = (yield* findActiveLanguagePair(input.languagePair))._id

  const collections = yield* db(() => Collection.find(filters).populate(POPULATED_PATHS))
  const byId = new Map(collections.map(collection => [String(collection._id), collection]))
  // Keep the order in which the learner pinned collections.
  const ordered = pinnedIds.map(id => byId.get(id)).filter(collection => collection !== undefined)

  return {
    collections: ordered.map(collection => serializeCollection(collection, input.viewer)),
    meta: { total: ordered.length, page: 1, perPage: ordered.length } satisfies PageMeta,
  }
})

export const pinCollection = Effect.fn('pinCollection')(function* (id: unknown, viewer: UserDocument) {
  const collection = yield* findAccessibleCollection(yield* collectionId(id), viewer)
  const updatedViewer = yield* db(() =>
    User.findByIdAndUpdate(
      viewer._id,
      { $addToSet: { pinnedCollections: collection._id } },
      { returnDocument: 'after' }
    )
  )
  return serializeCollection(collection, updatedViewer ?? viewer)
})

/** Unpins a collection; returns the refreshed collection, or null when the viewer can no longer read it. */
export const unpinCollection = Effect.fn('unpinCollection')(function* (id: unknown, viewer: UserDocument) {
  const _id = yield* collectionId(id)
  const updatedViewer =
    (yield* db(() =>
      User.findByIdAndUpdate(viewer._id, { $pull: { pinnedCollections: _id } }, { returnDocument: 'after' })
    )) ?? viewer
  const collection = yield* db(() =>
    Collection.findOne({ _id, $or: collectionAccessConditions(updatedViewer) }).populate(POPULATED_PATHS)
  )
  return collection ? serializeCollection(collection, updatedViewer) : null
})

function refreshSentenceCount(collection: CollectionDocument) {
  return Effect.gen(function* () {
    collection.sentenceCount = yield* db(() =>
      CollectionSentence.countDocuments({ collection: collection._id })
    )
    yield* db(() => collection.save())
  })
}

export const createSentence = Effect.fn('createSentence')(function* (
  collectionIdValue: unknown,
  payload: SentencePayload,
  viewer: UserDocument
) {
  const collection = yield* findOwnedCollection(collectionIdValue, viewer)
  const sentence = yield* db(() =>
    CollectionSentence.create({
      ...payload,
      owner: viewer._id,
      collection: collection._id,
      order: collection.sentenceCount,
    })
  )
  yield* refreshSentenceCount(collection)
  return serializeSentence(sentence)
})

export const updateSentence = Effect.fn('updateSentence')(function* (
  collectionIdValue: unknown,
  sentenceId: unknown,
  payload: SentencePayload,
  viewer: UserDocument
) {
  const collection = yield* findOwnedCollection(collectionIdValue, viewer)
  const _id = yield* objectId(sentenceId, () => new NotFound({ message: 'Sentence not found.' }))
  const sentence = yield* db(() => CollectionSentence.findOne({ _id, collection: collection._id }))
  if (!sentence) return yield* new NotFound({ message: 'Sentence not found.' })

  sentence.set(payload)
  yield* db(() => sentence.save())
  return serializeSentence(sentence)
})

export const deleteSentence = Effect.fn('deleteSentence')(function* (
  collectionIdValue: unknown,
  sentenceId: unknown,
  viewer: UserDocument
) {
  const collection = yield* findOwnedCollection(collectionIdValue, viewer)
  const _id = yield* objectId(sentenceId, () => new NotFound({ message: 'Sentence not found.' }))
  const result = yield* db(() => CollectionSentence.deleteOne({ _id, collection: collection._id }))
  if (result.deletedCount === 0) return yield* new NotFound({ message: 'Sentence not found.' })
  yield* refreshSentenceCount(collection)
})

export const listSentences = Effect.fn('listSentences')(function* (input: {
  collectionId: unknown
  viewer: UserDocument
  query: z.output<typeof listSentencesQuerySchema>
}) {
  const collection = yield* findAccessibleCollection(yield* collectionId(input.collectionId), input.viewer)
  const { query, context, page, perPage } = input.query
  const filters: Record<string, unknown> = { collection: collection._id }
  // User input is escaped so a search cannot run an arbitrary (or catastrophic) regular expression.
  if (query) filters[context] = { $regex: escapeRegex(query), $options: 'i' }

  const [total, sentences] = yield* Effect.all(
    [
      db(() => CollectionSentence.countDocuments(filters)),
      db(() =>
        CollectionSentence.find(filters)
          .sort({ order: 1, _id: 1 })
          .skip((page - 1) * perPage)
          .limit(perPage)
      ),
    ],
    { concurrency: 'unbounded' }
  )

  return {
    sentences: sentences.map(serializeSentence) satisfies SentenceDto[],
    meta: { total, page, perPage } satisfies PageMeta,
  }
})
