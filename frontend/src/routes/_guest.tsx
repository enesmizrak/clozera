import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { PublicFooter } from '@/components/public-footer'
import { PublicHeader } from '@/components/site-header'
import { homePathFor, sessionQuery } from '@/data/session'

/** Sign-in pages. Signed-in learners go straight to the app. */
export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery)
    if (user) throw redirect({ to: homePathFor(user) })
  },
  component: GuestLayout,
})

function GuestLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
