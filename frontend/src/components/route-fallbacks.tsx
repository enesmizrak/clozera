import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { errorMessage } from '@/lib/api'

export function NotFoundPage() {
  return (
    <main className="page-shell">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you are looking for does not exist or is no longer available.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Go home
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  )
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <main className="page-shell">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>{errorMessage(error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
