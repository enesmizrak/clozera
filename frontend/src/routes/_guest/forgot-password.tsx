import { forgotPasswordSchema } from '@clozera/shared'
import { Link, createFileRoute } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { FormError, useAppForm } from '@/components/form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'

export const Route = createFileRoute('/_guest/forgot-password')({
  validateSearch: z.object({ email: z.string().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: 'Forgot password · Clozera' }] }),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const search = Route.useSearch()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { email: search.email ?? '' },
    validators: { onSubmit: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { email } = forgotPasswordSchema.parse(value)
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
      if (error) {
        setServerError(authErrorMessage(error, 'Unable to send the email. Please try again.'))
        return
      }
      setSentTo(email)
    },
  })

  if (sentTo) {
    return (
      <Card>
        <CardHeader>
          <MailCheck className="mb-2 size-8 text-primary" aria-hidden="true" />
          <CardTitle className="text-3xl">
            <h1>Check your email.</h1>
          </CardTitle>
          {/* The same answer for every address, so this page never reveals who has an account. */}
          <CardDescription>
            If an account exists for <strong className="text-foreground">{sentTo}</strong>, we sent a link to
            choose a new password. The link is valid for 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Back to log in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">
          <h1>Forgot your password?</h1>
        </CardTitle>
        <CardDescription>Enter your email and we will send you a link to choose a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={event => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.AppField name="email">
              {field => <field.TextField label="Email" type="email" autoComplete="email" required />}
            </form.AppField>
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton className="w-full">Send reset link</form.SubmitButton>
            </form.AppForm>
            <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">
              Back to log in
            </Link>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
