import type { CollectionDto } from '@clozera/shared'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { Outlet, createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'
import { collectionQuery, libraryCollection, sentencesCollection } from '@/data/collections'
import { ApiError } from '@/lib/api'

/** Loads one collection and its sentences into TanStack DB for the detail and practice pages. */
export const Route = createFileRoute('/_app/dashboard/collections/$collectionId')({
  loader: async ({ context, params }) => {
    const detail = await context.queryClient
      .ensureQueryData(collectionQuery(params.collectionId))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) throw notFound()
        throw error
      })
    const languagePair = detail.languagePair?.slug ?? context.user.selectedLanguagePair?.slug ?? ''
    await Promise.all([
      libraryCollection(languagePair).preload(),
      sentencesCollection(params.collectionId).preload(),
    ])
    return { languagePair, detail }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.detail.name ?? 'Collection'} · Clozera` }] }),
  component: Outlet,
})

const collectionRoute = getRouteApi('/_app/dashboard/collections/$collectionId')

/** The live collection row, falling back to the loaded detail until the library has it. */
export function useCurrentCollection(): CollectionDto {
  const { collectionId } = collectionRoute.useParams()
  const { languagePair, detail } = collectionRoute.useLoaderData()
  const library = libraryCollection(languagePair)
  const { data } = useLiveQuery({
    query: q =>
      q
        .from({ collection: library })
        .where(({ collection }) => eq(collection.id, collectionId))
        .findOne(),
  })
  return data ?? detail
}

export function useCollectionSentences() {
  const { collectionId } = collectionRoute.useParams()
  const sentences = sentencesCollection(collectionId)
  const { data, isReady } = useLiveQuery({ query: q => q.from({ sentence: sentences }) })
  return { sentences: data, isReady }
}
