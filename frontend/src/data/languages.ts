import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

const ONE_HOUR = 60 * 60_000

export const languagesQuery = queryOptions({
  queryKey: ['languages'],
  queryFn: ({ signal }) => api.languages(signal),
  staleTime: ONE_HOUR,
})

export const languagePairsQuery = queryOptions({
  queryKey: ['language-pairs'],
  queryFn: ({ signal }) => api.languagePairs(signal),
  staleTime: ONE_HOUR,
})
