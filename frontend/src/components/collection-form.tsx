import { type CollectionDto, type CollectionFormInput, collectionFormSchema } from '@clozera/shared'
import { type ReactNode, useState } from 'react'
import { FieldGroup } from '@/components/ui/field'
import { FormError, useAppForm } from '@/components/form'
import { errorMessage } from '@/lib/api'

/** Create and edit share the same fields and the API's validation schema. */
export function CollectionForm({
  collection,
  onSubmit,
  children,
}: {
  collection?: CollectionDto
  onSubmit: (input: CollectionFormInput) => Promise<unknown>
  children?: ReactNode
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: {
      name: collection?.name ?? '',
      description: collection?.description ?? '',
      visibility: collection?.visibility ?? 'private',
    } as CollectionFormInput,
    validators: { onChange: collectionFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await onSubmit(collectionFormSchema.parse(value))
      } catch (error) {
        setServerError(errorMessage(error, 'Unable to save this collection.'))
      }
    },
  })

  return (
    <form
      noValidate
      onSubmit={event => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.AppField name="name">
          {field => <field.TextField label="Collection name" required />}
        </form.AppField>
        <form.AppField name="description">
          {field => <field.TextareaField label="Description" rows={3} description="Markdown is supported." />}
        </form.AppField>
        <form.AppField name="visibility">
          {field => (
            <field.ToggleField
              label="Make public"
              description="Public collections appear in the Community shelf for other learners."
              checkedValue="public"
              uncheckedValue="private"
            />
          )}
        </form.AppField>
        <FormError message={serverError} />
        <form.AppForm>
          <form.SubmitButton className="w-full">
            {collection ? 'Save changes' : 'Create collection'}
          </form.SubmitButton>
        </form.AppForm>
        {children}
      </FieldGroup>
    </form>
  )
}
