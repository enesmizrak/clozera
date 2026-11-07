import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

/**
 * TanStack Form bound to shadcn Field components. Forms validate with the shared Zod schemas
 * and show errors once a field is touched or the form is submitted.
 */
export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

function useFieldState<T>() {
  const field = useFieldContext<T>()
  // Unique per rendered field, so two forms on one page never share label targets.
  const id = `${useId()}-${field.name}`
  const { meta } = field.state
  const invalid = (meta.isTouched || field.form.state.submissionAttempts > 0) && !meta.isValid
  return { field, id, invalid, errors: meta.errors as Array<{ message?: string } | undefined> }
}

interface BaseFieldProps {
  label: ReactNode
  description?: ReactNode
}

function TextField({
  label,
  description,
  ...inputProps
}: BaseFieldProps & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>) {
  const { field, id, invalid, errors } = useFieldState<string>()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={event => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        {...inputProps}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

function PasswordField({ label, description, autoComplete }: BaseFieldProps & { autoComplete: string }) {
  const { field, id, invalid, errors } = useFieldState<string>()
  const [visible, setVisible] = useState(false)
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          name={field.name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={event => field.handleChange(event.target.value)}
          aria-invalid={invalid}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

function TextareaField({
  label,
  description,
  ...textareaProps
}: BaseFieldProps & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur' | 'name' | 'id'>) {
  const { field, id, invalid, errors } = useFieldState<string>()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={event => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        {...textareaProps}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

/** A checkbox for a two-value string field, such as visibility (`public` / `private`). */
function ToggleField<T extends string>({
  label,
  description,
  checkedValue,
  uncheckedValue,
}: BaseFieldProps & { checkedValue: T; uncheckedValue: T }) {
  const { field, id } = useFieldState<T>()
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        name={field.name}
        checked={field.state.value === checkedValue}
        onCheckedChange={checked => field.handleChange(checked ? checkedValue : uncheckedValue)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
    </Field>
  )
}

function SubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={state => [state.isSubmitting, state.canSubmit] as const}>
      {([isSubmitting, canSubmit]) => (
        <Button type="submit" className={className} disabled={isSubmitting || !canSubmit}>
          {isSubmitting && <Spinner />}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, PasswordField, TextareaField, ToggleField },
  formComponents: { SubmitButton },
})
