import { signUpSchema } from '@clozera/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { FormError, useAppForm } from '@/components/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { safeRedirect, sessionQuery } from '@/data/session'
import { authClient, browserTimezone } from '@/lib/auth-client'
import { authSearchSchema } from './-auth'

export const Route = createFileRoute('/_guest/sign-up')({
  validateSearch: authSearchSchema,
  head: () => ({ meta: [{ title: 'Sign up · Clozera' }] }),
  component: SignUpPage,
})

function SignUpPage() {
  const search = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: '', username: '', email: '', password: '' },
    validators: { onChange: signUpSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      const { error } = await authClient.signUp.email({
        ...signUpSchema.parse(value),
        timezone: browserTimezone(),
      })
      if (error) {
        setServerError(error.message ?? 'Unable to create your account.')
        return
      }
      await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 })
      await router.invalidate()
      // New learners always choose a language pair first.
      await router.navigate({ href: safeRedirect(search.redirect) ?? '/languages', replace: true })
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
