import { Spinner } from '@/components/ui/spinner'

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <output className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Spinner aria-hidden="true" role="presentation" />
      {label}
    </output>
  )
}
