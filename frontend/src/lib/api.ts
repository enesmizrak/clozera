import type {
  ApiData,
  ApiErrorBody,
  ApiFieldIssue,
  CollectionCreateInput,
  CollectionDto,
  CollectionUpdateInput,
  LanguageDto,
  LanguagePairDto,
  PageMeta,
  ProfileUpdateInput,
  SentenceDto,
  SentenceInput,
  UserDto,
} from '@clozera/shared'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiFieldIssue[]

  constructor(status: number, body: Partial<ApiErrorBody['error']> = {}) {
    super(body.message || 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code ?? 'UNKNOWN_ERROR'
    this.details = body.details ?? []
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Browsers call the same-origin `/api` proxy. During SSR the server calls the API directly
 * and forwards the visitor's cookie so the response matches what the browser would see.
 */
const requestTarget = createIsomorphicFn()
  .server(() => ({
    baseUrl: process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
    headers: { cookie: getRequestHeader('cookie') ?? '' } as Record<string, string>,
  }))
  .client(() => ({ baseUrl: '', headers: {} as Record<string, string> }))

type Query = Record<string, string | number | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { baseUrl, headers } = requestTarget()
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const url = `${baseUrl}/api${path}${search.size ? `?${search}` : ''}`

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    signal: options.signal,
    headers: {
      ...headers,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (response.status === 204) return undefined as T
  const payload = (await response.json().catch(() => ({}))) as T & Partial<ApiErrorBody>
  if (!response.ok) throw new ApiError(response.status, payload.error)
  return payload
}

const data = async <T>(promise: Promise<ApiData<T>>) => (await promise).data

/** Loads every page of a paginated list endpoint. The API caps pages at 100 rows. */
async function allPages<K extends string, T>(
  path: string,
  key: K,
  query: Query,
  signal?: AbortSignal
): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page += 1) {
    const response = await apiRequest<{ data: Record<K, T[]>; meta: PageMeta }>(path, {
      query: { ...query, page, perPage: 100 },
      signal,
    })
    rows.push(...response.data[key])
    if (response.data[key].length === 0 || rows.length >= response.meta.total) return rows
  }
}

export const api = {
  session: (signal?: AbortSignal) => data(apiRequest<ApiData<UserDto | null>>('/session', { signal })),
  updateProfile: (body: ProfileUpdateInput) =>
    data(apiRequest<ApiData<UserDto>>('/users/me', { method: 'PATCH', body })),

  languages: (signal?: AbortSignal) => data(apiRequest<ApiData<LanguageDto[]>>('/languages', { signal })),
  languagePairs: (signal?: AbortSignal) =>
    data(apiRequest<ApiData<LanguagePairDto[]>>('/language-pairs', { signal })),

  collections: (languagePair: string, signal?: AbortSignal) =>
    allPages<'collections', CollectionDto>('/collections', 'collections', { languagePair }, signal),
  collection: (id: string, signal?: AbortSignal) =>
    data(apiRequest<ApiData<CollectionDto>>(`/collections/${id}`, { signal })),
  createCollection: (body: CollectionCreateInput) =>
    data(apiRequest<ApiData<CollectionDto>>('/collections', { method: 'POST', body })),
  updateCollection: (id: string, body: CollectionUpdateInput) =>
    data(apiRequest<ApiData<CollectionDto>>(`/collections/${id}`, { method: 'PATCH', body })),
  deleteCollection: (id: string) => apiRequest<void>(`/collections/${id}`, { method: 'DELETE' }),
  pinCollection: (collectionId: string) =>
    data(
      apiRequest<ApiData<CollectionDto>>('/dashboard/collections', { method: 'POST', body: { collectionId } })
    ),
  unpinCollection: async (collectionId: string) =>
    (
      await apiRequest<ApiData<CollectionDto> | undefined>(`/dashboard/collections/${collectionId}`, {
        method: 'DELETE',
      })
    )?.data ?? null,

  sentences: (collectionId: string, signal?: AbortSignal) =>
    allPages<'sentences', SentenceDto>(`/collections/${collectionId}/sentences`, 'sentences', {}, signal),
  createSentence: (collectionId: string, body: SentenceInput) =>
    data(
      apiRequest<ApiData<SentenceDto>>(`/collections/${collectionId}/sentences`, { method: 'POST', body })
    ),
  updateSentence: (collectionId: string, sentenceId: string, body: SentenceInput) =>
    data(
      apiRequest<ApiData<SentenceDto>>(`/collections/${collectionId}/sentences/${sentenceId}`, {
        method: 'PATCH',
        body,
      })
    ),
  deleteSentence: (collectionId: string, sentenceId: string) =>
    apiRequest<void>(`/collections/${collectionId}/sentences/${sentenceId}`, { method: 'DELETE' }),
}
