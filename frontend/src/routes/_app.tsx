import { Outlet, createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PageSpinner } from '@/components/page-status'
import { AppHeader } from '@/components/site-header'
import { ensureLearnerScope, resetLearnerData } from '@/data/collections'
import { languagePairsQuery } from '@/data/languages'
import { endLearnerSession } from '@/data/learner-session'
import { sessionQuery, useSessionUser } from '@/data/session'

/**
 * The signed-in app. It renders on the client only: its data lives in TanStack DB
 * collections, which do not run during SSR.
 */
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData({ ...sessionQuery, revalidateIfStale: true })
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    await ensureLearnerScope(user.id)
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
  const user = useSessionUser()
  const router = useRouter()

  // The session can end elsewhere (other device, password reset, expiry): leave the app and drop learner data.
  useEffect(() => {
    if (user !== null) return
    void endLearnerSession({
      clearSession: () => {},
      navigate: () =>
        router.navigate({ to: '/login', search: { redirect: router.state.location.href }, replace: true }),
      reset: resetLearnerData,
      invalidate: () => router.invalidate(),
    })
  }, [user, router])

  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
