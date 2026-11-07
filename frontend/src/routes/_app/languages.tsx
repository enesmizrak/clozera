import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { FormError, useAppForm } from '@/components/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { languagePairsQuery, languagesQuery } from '@/data/languages'
import { sessionQuery } from '@/data/session'
import { api, errorMessage } from '@/lib/api'

export const Route = createFileRoute('/_app/languages')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(languagesQuery),
      context.queryClient.ensureQueryData(languagePairsQuery),
    ]),
  head: () => ({ meta: [{ title: 'Choose your languages · Clozera' }] }),
  component: LanguagePairPage,
})

const languagePairSchema = z.object({
  baseLanguage: z.string().min(1, 'Select the language you speak.'),
  languagePair: z.string().min(1, 'Select a language to learn.'),
})

function LanguagePairPage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: languages } = useSuspenseQuery(languagesQuery)
  const { data: pairs } = useSuspenseQuery(languagePairsQuery)
  const [serverError, setServerError] = useState<string | null>(null)

  const selectedPair = pairs.find(pair => pair.slug === user.selectedLanguagePair?.slug)
  const form = useAppForm({
    defaultValues: {
      baseLanguage:
        selectedPair?.baseLanguage.code ?? (languages.length === 1 ? (languages[0]?.code ?? '') : ''),
      languagePair: selectedPair?.slug ?? '',
    },
    validators: { onSubmit: languagePairSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        const updated = await api.updateProfile({ selectedLanguagePairSlug: value.languagePair })
        queryClient.setQueryData(sessionQuery.queryKey, updated)
        await router.invalidate()
        await router.navigate({ to: '/dashboard' })
      } catch (error) {
        setServerError(errorMessage(error, 'Unable to save your language pair.'))
      }
    },
  })

  const languageItems = languages.map(language => ({ value: language.code, label: language.name }))

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            <h1>Choose your languages.</h1>
          </CardTitle>
          <CardDescription>Pick the language you speak and the one you want to learn.</CardDescription>
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
              <form.Field
                name="baseLanguage"
                listeners={{ onChange: () => form.setFieldValue('languagePair', '') }}
              >
                {field => (
                  <Field>
                    <FieldLabel htmlFor="base-language">I speak</FieldLabel>
                    <Select
                      items={languageItems}
                      value={field.state.value || null}
                      onValueChange={value => field.handleChange(value ?? '')}
                    >
                      <SelectTrigger id="base-language" className="w-full">
                        <SelectValue placeholder="Select your language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languageItems.map(item => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={state => state.values.baseLanguage}>
                {baseLanguage => {
                  const pairItems = pairs
                    .filter(pair => pair.baseLanguage.code === baseLanguage)
                    .map(pair => ({ value: pair.slug, label: pair.targetLanguage.name }))
                  return (
                    <form.Field name="languagePair">
                      {field => (
                        <Field data-invalid={field.state.meta.errors.length > 0}>
                          <FieldLabel htmlFor="target-language">I want to learn</FieldLabel>
                          <Select
                            items={pairItems}
                            value={field.state.value || null}
                            onValueChange={value => field.handleChange(value ?? '')}
                            disabled={!pairItems.length}
                          >
                            <SelectTrigger id="target-language" className="w-full">
                              <SelectValue placeholder="Select a language to learn" />
                            </SelectTrigger>
                            <SelectContent>
                              {pairItems.map(item => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {baseLanguage && !pairItems.length && (
                            <FieldDescription>
                              No language pairs are available for this language yet.
                            </FieldDescription>
                          )}
                          <FieldError errors={field.state.meta.errors as Array<{ message?: string }>} />
                        </Field>
                      )}
                    </form.Field>
                  )
                }}
              </form.Subscribe>
              <FormError message={serverError} />
              <form.AppForm>
                <form.SubmitButton className="w-full">Continue</form.SubmitButton>
              </form.AppForm>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
