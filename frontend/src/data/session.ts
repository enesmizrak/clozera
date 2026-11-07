import type { UserDto } from '@clozera/shared'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: ({ signal }) => api.session(signal),
  staleTime: 5 * 60_000,
})

/** The signed-in learner, kept fresh by the session query. */
export function useSessionUser(): UserDto | null {
  return useQuery(sessionQuery).data ?? null
}

export type AppPath = '/dashboard' | '/languages'

/** Learners pick a language pair before they reach the dashboard. */
export function homePathFor(user: Pick<UserDto, 'selectedLanguagePair'>): AppPath {
  return user.selectedLanguagePair ? '/dashboard' : '/languages'
}

/** Accepts only same-origin absolute paths, so `?redirect=` cannot send people elsewhere. */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value)
    ? value
    : null
}
