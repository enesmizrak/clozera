import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { NotFoundPage, RouteErrorPage } from '@/components/route-fallbacks'
import { PageSpinner } from '@/components/page-status'
import { getQueryClient } from '@/data/query-client'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = getQueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // TanStack Query decides freshness; the router always asks it.
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => <PageSpinner />,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: RouteErrorPage,
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
