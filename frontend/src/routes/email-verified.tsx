import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { z } from 'zod'
import { PublicLayout } from '@/components/public-layout'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { homePathFor, safeRedirect, sessionQuery } from '@/data/session'

/**
 * Landing page for email verification links. Better Auth verifies the token, signs the learner in
 * and redirects here, or adds `?error=` when the link is invalid or expired.
 */
export const Route = createFileRoute('/email-verified')({
  validateSearch: z.object({
    error: z.string().optional().catch(undefined),
    redirect: z.string().optional().catch(undefined),
  }),
  beforeLoad: async ({ context, search }) => {
    if (search.error) return
    const user = await context.queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
    if (user) throw redirect({ href: safeRedirect(search.redirect) ?? homePathFor(user), replace: true })
  },
  head: () => ({ meta: [{ title: 'Email confirmation · Clozera' }] }),
  component: EmailVerifiedPage,
})

function EmailVerifiedPage() {
  const { error } = Route.useSearch()
  return (
    <PublicLayout>
      <Card>
        <CardHeader>
          {error ? (
            <TriangleAlert className="mb-2 size-8 text-destructive" aria-hidden="true" />
          ) : (
            <CircleCheck className="mb-2 size-8 text-success" aria-hidden="true" />
          )}
          <CardTitle className="text-3xl">
            <h1>{error ? 'This link has expired.' : 'Email confirmed.'}</h1>
          </CardTitle>
          <CardDescription>
            {error
              ? 'Confirmation links expire after 24 hours and work once. Log in and we will email you a new link.'
              : 'Your email address is confirmed. Log in to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants({ className: 'w-full' })}>
            Log in
          </Link>
        </CardContent>
      </Card>
    </PublicLayout>
  )
}
