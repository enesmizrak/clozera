import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (401, 404, validation) will not succeed on retry.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

/**
 * Server renders get a fresh client per request so data never leaks between visitors.
 * The browser keeps one client, shared by the router and TanStack DB collections.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient()
  return (browserQueryClient ??= makeQueryClient())
}
