import {
  type CollectionCreateInput,
  type CollectionDto,
  type CollectionFormInput,
  type SentenceDto,
  type SentenceInput,
  normalizeSentencePayload,
} from '@clozera/shared'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryOptions } from '@tanstack/react-query'
import { createCollection } from '@tanstack/react-db'
import { api } from '@/lib/api'
import { getQueryClient } from './query-client'

/**
 * TanStack DB keeps the learner's library and sentences in client-side collections.
 * Live queries derive the dashboard, shelves and tables from them, and mutations
 * apply optimistically before the API confirms them. Collections are browser-only;
 * routes that use them disable SSR.
 */

function createLibraryCollection(languagePair: string) {
  return createCollection(
    queryCollectionOptions({
      id: `library:${languagePair}`,
      queryKey: ['library', languagePair],
      queryFn: ({ signal }) => api.collections(languagePair, signal),
      queryClient: getQueryClient(),
      getKey: (collection: CollectionDto) => collection.id,
      onUpdate: async ({ transaction, collection }) => {
        for (const mutation of transaction.mutations) {
          const { changes, key } = mutation
          const saved =
            changes.isPinned === undefined
              ? await api.updateCollection(String(key), {
                  name: changes.name,
                  description: changes.description,
                  visibility: changes.visibility,
                })
              : changes.isPinned
                ? await api.pinCollection(String(key))
                : await api.unpinCollection(String(key))
          if (saved) await collection.utils.writeUpdate(saved)
          else await collection.utils.writeDelete(key)
        }
      },
      onDelete: async ({ transaction, collection }) => {
        for (const { key } of transaction.mutations) {
          await api.deleteCollection(String(key))
          await collection.utils.writeDelete(key)
        }
      },
    })
  )
}

function createSentencesCollection(collectionId: string) {
  return createCollection(
    queryCollectionOptions({
      id: `sentences:${collectionId}`,
      queryKey: ['sentences', collectionId],
      queryFn: ({ signal }) => api.sentences(collectionId, signal),
      queryClient: getQueryClient(),
      getKey: (sentence: SentenceDto) => sentence.id,
      onUpdate: async ({ transaction, collection }) => {
        for (const { modified } of transaction.mutations) {
          await collection.utils.writeUpdate(await api.updateSentence(collectionId, modified.id, modified))
        }
      },
      onDelete: async ({ transaction, collection }) => {
        for (const { key } of transaction.mutations) {
          await api.deleteSentence(collectionId, String(key))
          await collection.utils.writeDelete(key)
        }
      },
    })
  )
}

type LibraryCollection = ReturnType<typeof createLibraryCollection>
type SentencesCollection = ReturnType<typeof createSentencesCollection>

const libraries = new Map<string, LibraryCollection>()
const sentenceLists = new Map<string, SentencesCollection>()

/** Every collection the learner can see in one language pair: official, owned and community. */
export function libraryCollection(languagePair: string): LibraryCollection {
  let collection = libraries.get(languagePair)
  if (!collection) {
    collection = createLibraryCollection(languagePair)
    libraries.set(languagePair, collection)
  }
  return collection
}

export function sentencesCollection(collectionId: string): SentencesCollection {
  let collection = sentenceLists.get(collectionId)
  if (!collection) {
    collection = createSentencesCollection(collectionId)
    sentenceLists.set(collectionId, collection)
  }
  return collection
}

/** A single collection, used to find its language pair before the library is loaded. */
export const collectionQuery = (collectionId: string) =>
  queryOptions({
    queryKey: ['collection', collectionId],
    queryFn: ({ signal }) => api.collection(collectionId, signal),
  })

let loadedFor: string | null = null

/** Drops learner data loaded for someone else, e.g. after a different learner signs in on this tab. */
export async function ensureLearnerScope(userId: string): Promise<void> {
  if (loadedFor !== null && loadedFor !== userId) await resetLearnerData()
  loadedFor = userId
}

/** Learner data must not survive a sign-out: drop every collection and cached query. */
export async function resetLearnerData(): Promise<void> {
  loadedFor = null
  const collections = [...libraries.values(), ...sentenceLists.values()]
  libraries.clear()
  sentenceLists.clear()
  await Promise.all(collections.map(collection => collection.cleanup({ dependents: true })))
  // Keep the (now signed-out) session entry; drop everything learner-specific.
  getQueryClient().removeQueries({ predicate: query => query.queryKey[0] !== 'session' })
}

function libraryOf(collection: Pick<CollectionDto, 'languagePair'>): LibraryCollection {
  if (!collection.languagePair) throw new Error('Collection has no language pair.')
  return libraryCollection(collection.languagePair.slug)
}

export function togglePinned(collection: CollectionDto): Promise<unknown> {
  const transaction = libraryOf(collection).update(collection.id, draft => {
    draft.isPinned = !draft.isPinned
    draft.capabilities.canPin = !draft.isPinned
    draft.capabilities.canUnpin = draft.isPinned
  })
  return transaction.when('settled')
}

export function saveCollectionDetails(collection: CollectionDto, input: CollectionFormInput): Promise<unknown> {
  const transaction = libraryOf(collection).update(collection.id, draft => {
    draft.name = input.name.trim()
    draft.description = (input.description ?? '').trim()
    draft.visibility = input.visibility
    draft.isPublic = input.visibility === 'public'
  })
  return transaction.when('settled')
}

export function deleteCollection(collection: CollectionDto): Promise<unknown> {
  return libraryOf(collection).delete(collection.id).when('settled')
}

/** Creation waits for the server, which assigns the id and slug, then writes the result locally. */
export async function createLearnerCollection(languagePair: string, input: CollectionCreateInput) {
  const created = await api.createCollection({ ...input, languagePairSlug: languagePair })
  await libraryCollection(languagePair).utils.writeInsert(created)
  return created
}

/** Sentence counts are maintained by the API. Refreshing the row is best effort: the change itself already succeeded. */
async function refreshCollection(collection: CollectionDto) {
  try {
    await libraryOf(collection).utils.writeUpsert(await api.collection(collection.id))
  } catch {
    // The next library refetch corrects the count.
  }
}

export async function addSentence(collection: CollectionDto, input: SentenceInput) {
  const created = await api.createSentence(collection.id, input)
  await sentencesCollection(collection.id).utils.writeInsert(created)
  await refreshCollection(collection)
  return created
}

export function editSentence(collection: CollectionDto, sentenceId: string, input: SentenceInput) {
  const normalized = normalizeSentencePayload(input)
  const transaction = sentencesCollection(collection.id).update(sentenceId, draft => {
    Object.assign(draft, normalized)
  })
  return transaction.when('settled')
}

export async function removeSentence(collection: CollectionDto, sentenceId: string) {
  await sentencesCollection(collection.id).delete(sentenceId).when('settled')
  await refreshCollection(collection)
}
