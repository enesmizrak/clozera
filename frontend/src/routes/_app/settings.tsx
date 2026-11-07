import { changeEmailSchema, changePasswordSchema } from '@clozera/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { FormError, useAppForm } from '@/components/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { useSessionUser } from '@/data/session'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'

export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: 'Settings · Clozera' }] }),
  component: SettingsPage,
})

function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { newEmail: '' },
    validators: { onSubmit: changeEmailSchema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null)
      const { newEmail } = changeEmailSchema.parse(value)
      const { error } = await authClient.changeEmail({ newEmail, callbackURL: '/email-changed' })
      if (error) {
        setServerError(authErrorMessage(error, 'Unable to change your email.'))
        return
      }
      setPendingEmail(newEmail)
      formApi.reset()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Email</h2>
        </CardTitle>
        <CardDescription>
          Your account uses <strong className="text-foreground">{currentEmail}</strong>. To change it, approve
          the change from this inbox, then confirm the new address.
        </CardDescription>
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
            <form.AppField name="newEmail">
              {field => <field.TextField label="New email" type="email" autoComplete="email" />}
            </form.AppField>
            {pendingEmail && (
              <output className="text-sm text-muted-foreground">
                We sent an approval link to {currentEmail}. After you approve it, we will send a confirmation
                link to {pendingEmail}.
              </output>
            )}
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton>Change email</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function ChangePasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validators: { onChange: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null)
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        setServerError(authErrorMessage(error, 'Unable to change your password.'))
        return
      }
      formApi.reset()
      toast.success('Password changed. Other devices were signed out.')
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Password</h2>
        </CardTitle>
        <CardDescription>Changing your password signs you out on other devices.</CardDescription>
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
            <form.AppField name="currentPassword">
              {field => <field.PasswordField label="Current password" autoComplete="current-password" />}
            </form.AppField>
            <form.AppField name="newPassword">
              {field => <field.PasswordField label="New password" autoComplete="new-password" />}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {field => <field.PasswordField label="Confirm new password" autoComplete="new-password" />}
            </form.AppField>
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton>Change password</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function SettingsPage() {
  const user = useSessionUser()
  if (!user) return null
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.name} (@{user.username}).
        </p>
      </header>
      <ChangeEmailForm currentEmail={user.email} />
      <ChangePasswordForm />
    </main>
  )
}
