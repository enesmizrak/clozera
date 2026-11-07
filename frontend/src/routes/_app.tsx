import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { PageSpinner } from '@/components/page-status'
import { AppHeader } from '@/components/site-header'
import { languagePairsQuery } from '@/data/languages'
import { sessionQuery } from '@/data/session'

/**
 * The signed-in app. It renders on the client only: its data lives in TanStack DB
 * collections, which do not run during SSR.
 */
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    if (!user.selectedLanguagePair && location.pathname !== '/languages') throw redirect({ to: '/languages' })
    return { user }
  },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(languagePairsQuery)
  },
  pendingComponent: () => <PageSpinner label="Restoring session…" />,
  component: AppLayout,
})

function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
