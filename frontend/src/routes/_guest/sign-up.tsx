import { signUpSchema } from '@clozera/shared'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError, useAppForm } from '@/components/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { safeRedirect } from '@/data/session'
import { authClient, browserTimezone } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'
import { authSearchSchema, verificationCallbackURL } from './-auth'

export const Route = createFileRoute('/_guest/sign-up')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Sign up · Clozera' }] }),
  component: SignUpPage,
})

function SignUpPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: '', username: '', email: '', password: '' },
    validators: { onChange: signUpSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const input = signUpSchema.parse(value)
      const redirect = safeRedirect(search.redirect)
      const { error } = await authClient.signUp.email({
        ...input,
        timezone: browserTimezone(),
        // The emailed link signs the learner in and continues from the verification page.
        callbackURL: verificationCallbackURL(redirect),
      })
      if (error) {
        setServerError(authErrorMessage(error, 'Unable to create your account.'))
        return
      }
      await router.navigate({ to: '/check-email', search: { email: input.email }, replace: true })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">
          <h1>Create your account.</h1>
        </CardTitle>
        <CardDescription>Start learning one missing word at a time.</CardDescription>
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
            <form.AppField name="name">
              {field => <field.TextField label="Name" autoComplete="name" required />}
            </form.AppField>
            <form.AppField name="username">
              {field => (
                <field.TextField
                  label="Username"
                  autoComplete="username"
                  description="Letters, numbers, dots and underscores."
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="email">
              {field => <field.TextField label="Email" type="email" autoComplete="email" required />}
            </form.AppField>
            <form.AppField name="password">
              {field => (
                <field.PasswordField
                  label="Password"
                  autoComplete="new-password"
                  description="At least 8 characters."
                />
              )}
            </form.AppField>
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton className="w-full">Create account</form.SubmitButton>
            </form.AppForm>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link className="text-primary underline" to="/login" search={search}>
                Log in
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
