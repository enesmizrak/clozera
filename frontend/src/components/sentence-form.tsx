import {
  type SentenceDto,
  type SentenceInput,
  listToText,
  sentenceParts,
  sentenceSchema,
} from '@clozera/shared'
import { z } from 'zod'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { FieldGroup } from '@/components/ui/field'
import { FormError, useAppForm } from '@/components/form'
import { errorMessage } from '@/lib/api'

/** The API schema, with answer lists edited as comma or newline separated text. */
const sentenceFormSchema = sentenceSchema.extend({
  alternativeAnswers: z.string(),
  multipleChoiceOptions: z.string(),
  hint: z.string().max(300),
  notes: z.string().max(2000),
})
type SentenceFormValues = z.input<typeof sentenceFormSchema>

function SentencePreview({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <p aria-label="Sentence preview" className="rounded-md bg-muted p-3">
      {sentenceParts(text).map((part, index) =>
        part.isCloze ? (
          <Badge key={index} variant="secondary">
            {part.text}
          </Badge>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </p>
  )
}

/** Sentence authoring: one `{{cloze}}` marker per sentence, validated with the API's schema. */
export function SentenceForm({
  sentence,
  onSubmit,
}: {
  sentence?: SentenceDto | null
  onSubmit: (input: SentenceInput) => Promise<unknown>
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useAppForm({
    defaultValues: {
      text: sentence?.text ?? '',
      translation: sentence?.translation ?? '',
      alternativeAnswers: listToText(sentence?.alternativeAnswers),
      multipleChoiceOptions: listToText(sentence?.multipleChoiceOptions),
      hint: sentence?.hint ?? '',
      notes: sentence?.notes ?? '',
    } satisfies SentenceFormValues,
    validators: { onChange: sentenceFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null)
      try {
        await onSubmit(value)
      } catch (error) {
        setServerError(errorMessage(error, 'Unable to save this sentence.'))
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
      <FieldGroup className="gap-5">
        <form.AppField name="text">
          {field => (
            <field.TextareaField
              label="Sentence"
              rows={2}
              placeholder="A {{missing}} word."
              description="Mark exactly one missing word or phrase with {{double braces}}."
            />
          )}
        </form.AppField>
        <form.Subscribe selector={state => state.values.text}>
          {text => <SentencePreview text={text} />}
        </form.Subscribe>
        <form.AppField name="translation">
          {field => (
            <field.TextareaField label="Translation" rows={2} placeholder="Translate the full sentence." />
          )}
        </form.AppField>
        <form.AppField name="alternativeAnswers">
          {field => (
            <field.TextareaField
              label="Alternative answers"
              rows={2}
              placeholder="Separate answers with commas or new lines."
            />
          )}
        </form.AppField>
        <form.AppField name="multipleChoiceOptions">
          {field => (
            <field.TextareaField
              label="Multiple choice options"
              rows={2}
              placeholder="Separate distractors with commas or new lines."
            />
          )}
        </form.AppField>
        <form.AppField name="hint">
          {field => <field.TextField label="Hint" placeholder="Optional hint" />}
        </form.AppField>
        <form.AppField name="notes">
          {field => (
            <field.TextareaField
              label="Notes"
              rows={3}
              placeholder="Optional notes"
              description="Markdown is supported."
            />
          )}
        </form.AppField>
        <FormError message={serverError} />
        <form.AppForm>
          <form.SubmitButton className="w-full">
            {sentence ? 'Save sentence' : 'Add sentence'}
          </form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </form>
  )
}
