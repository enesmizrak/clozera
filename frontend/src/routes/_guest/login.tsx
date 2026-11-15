import { loginSchema } from '@clozera/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError, useAppForm } from '@/components/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { homePathFor, safeRedirect, sessionQuery } from '@/data/session'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage } from '@/lib/auth-errors'
import { authSearchSchema, verificationCallbackURL } from './-auth'

export const Route = createFileRoute('/_guest/login')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Log in · Clozera' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const credentials = loginSchema.parse(value)
      const { error } = await authClient.signIn.email({
        ...credentials,
        callbackURL: verificationCallbackURL(safeRedirect(search.redirect)),
      })
      if (error?.code === 'EMAIL_NOT_VERIFIED') {
        // Better Auth has just emailed a fresh verification link.
        await router.navigate({
          to: '/check-email',
          search: { email: credentials.email, redirect: search.redirect },
        })
        return
      }
      if (error) {
        setServerError(authErrorMessage(error, 'Unable to log in.'))
        return
      }
      const user = await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
      // Navigate directly: invalidating first would let the guest guard redirect before this does.
      await router.navigate({
        href: safeRedirect(search.redirect) ?? (user ? homePathFor(user) : '/'),
        replace: true,
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">
          <h1>Welcome back.</h1>
        </CardTitle>
        <CardDescription>Log in to continue practicing.</CardDescription>
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
            <form.AppField name="password">
              {field => <field.PasswordField label="Password" autoComplete="current-password" />}
            </form.AppField>
            <form.Subscribe selector={state => state.values.email}>
              {email => (
                <Link
                  to="/forgot-password"
                  search={email ? { email } : {}}
                  className="-mt-3 self-end text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </form.Subscribe>
            <FormError message={serverError} />
            <form.AppForm>
              <form.SubmitButton className="w-full">Log in</form.SubmitButton>
            </form.AppForm>
            <p className="text-sm text-muted-foreground">
              New to Clozera?{' '}
              <Link className="text-primary underline" to="/sign-up" search={search}>
                Sign up
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
