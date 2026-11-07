import { Link, createFileRoute } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useCooldown } from '@/hooks/use-cooldown'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'
import { EMAIL_VERIFIED_PATH } from './-auth'

export const Route = createFileRoute('/_guest/check-email')({
  validateSearch: z.object({ email: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Check your email · Clozera' }] }),
  component: CheckEmailPage,
})

const RESEND_COOLDOWN_SECONDS = 60

function CheckEmailPage() {
  const { email } = Route.useSearch()
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)
  const [sending, setSending] = useState(false)

  async function resend() {
    if (!email) return
    setSending(true)
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: EMAIL_VERIFIED_PATH })
    setSending(false)
    if (error) {
      toast.error(authErrorMessage(error, 'Unable to send the email. Please try again.'))
      return
    }
    cooldown.start()
    toast.success('We sent a new link.')
  }

  return (
    <Card>
      <CardHeader>
        <MailCheck className="mb-2 size-8 text-primary" aria-hidden="true" />
        <CardTitle className="text-3xl">
          <h1>Check your email.</h1>
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            </>
          ) : (
            'We sent you a confirmation link.'
          )}{' '}
          Open it to finish setting up your account. The link is valid for 24 hours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">No email? Check your spam folder, or send a new link.</p>
        {email && (
          <Button
            variant="outline"
            className="w-full"
            disabled={sending || cooldown.remaining > 0}
            onClick={() => void resend()}
          >
            {sending && <Spinner />}
            {cooldown.remaining > 0 ? `Send again in ${cooldown.remaining}s` : 'Send a new link'}
          </Button>
        )}
        <Link to="/login" className={buttonVariants({ variant: 'ghost', className: 'w-full' })}>
          Back to log in
        </Link>
      </CardContent>
    </Card>
  )
}
