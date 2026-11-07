import { resetPasswordSchema } from '@clozera/shared'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { FormError, useAppForm } from '@/components/form'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'

/** Better Auth redirects here from the emailed link with `?token=` or `?error=INVALID_TOKEN`. */
export const Route = createFileRoute('/_guest/reset-password')({
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: 'Choose a new password · Clozera' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token, error } = Route.useSearch()
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { newPassword: '', confirmPassword: '' },
    validators: { onChange: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const result = await authClient.resetPassword({ newPassword: value.newPassword, token })
      if (result.error) {
        setServerError(authErrorMessage(result.error, 'Unable to set a new password.'))
        return
      }
      setDone(true)
    },
  })

  if (!token || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            <h1>This link has expired.</h1>
          </CardTitle>
          <CardDescription>
            Password reset links work once and expire after 1 hour. Request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/forgot-password" className={buttonVariants({ className: 'w-full' })}>
            Send a new link
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CircleCheck className="mb-2 size-8 text-success" aria-hidden="true" />
          <CardTitle className="text-3xl">
            <h1>Password updated.</h1>
          </CardTitle>
          <CardDescription>
            You were signed out on other devices. Log in with your new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/login" className={buttonVariants({ className: 'w-full' })}>
            Log in
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">
          <h1>Choose a new password.</h1>
        </CardTitle>
        <CardDescription>Use at least 8 characters.</CardDescription>
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
            <form.AppField name="newPassword">
              {field => <field.PasswordField label="New password" autoComplete="new-password" />}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {field => <field.PasswordField label="Confirm new password" autoComplete="new-password" />}
            </form.AppField>
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton className="w-full">Save new password</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
