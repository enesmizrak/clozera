import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { PublicLayout } from '@/components/public-layout'
import { homePathFor, sessionQuery } from '@/data/session'

/** Sign-in pages. Signed-in learners go straight to the app. */
export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (user) throw redirect({ to: homePathFor(user) })
  },
  component: () => (
    <PublicLayout>
      <Outlet />
    </PublicLayout>
  ),
})
