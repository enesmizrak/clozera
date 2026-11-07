import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { MailCheck, TriangleAlert } from 'lucide-react'
import { z } from 'zod'
import { PublicLayout } from '@/components/public-layout'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { sessionQuery } from '@/data/session'

/**
 * Both email change links land here: the approval from the current address, then the
 * confirmation from the new one. The session shows which address the account uses now.
 */
export const Route = createFileRoute('/email-changed')({
  validateSearch: z.object({ error: z.string().optional().catch(undefined) }),
  loader: ({ context }) => context.queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 }),
  head: () => ({ meta: [{ title: 'Email change · Clozera' }] }),
  component: EmailChangedPage,
})

function EmailChangedPage() {
  const { error } = Route.useSearch()
  const { data: user } = useQuery(sessionQuery)

  return (
    <PublicLayout>
      <Card>
        <CardHeader>
          {error ? (
            <TriangleAlert className="mb-2 size-8 text-destructive" aria-hidden="true" />
          ) : (
            <MailCheck className="mb-2 size-8 text-primary" aria-hidden="true" />
          )}
          <CardTitle className="text-3xl">
            <h1>{error ? 'This link has expired.' : 'Email change in progress.'}</h1>
          </CardTitle>
          <CardDescription>
            {error
              ? 'Email change links expire after 24 hours and work once. Start the change again from your settings.'
              : 'If you just approved the change, open the confirmation link we sent to your new address. If you opened that link, the change is complete.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <p className="text-sm text-muted-foreground">
              Your account email is <strong className="text-foreground">{user.email}</strong>.
            </p>
          )}
          <Link to={user ? '/settings' : '/login'} className={buttonVariants({ className: 'w-full' })}>
            {user ? 'Go to settings' : 'Log in'}
          </Link>
        </CardContent>
      </Card>
    </PublicLayout>
  )
}
