import type { CollectionDto } from '@clozera/shared'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Rows3, Shuffle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRACTICE_ACTIVITY_OPTIONS, PRACTICE_MODE_OPTIONS } from '@/lib/practice-options'
import { SESSION_LIMIT_OPTIONS, practiceModeFromValue, sessionLimitFromValue } from '@/lib/practice-session'
import { usePreferences } from '@/stores/preferences'

const limitItems = SESSION_LIMIT_OPTIONS.map(value => ({ value: String(value), label: String(value) }))

/** Practice setup. The last chosen mode and round size are remembered on this device. */
export function PracticeDialog({
  collection,
  onClose,
}: {
  collection: CollectionDto | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const mode = usePreferences(state => state.practiceMode)
  const limit = usePreferences(state => state.practiceLimit)
  const setPracticeDefaults = usePreferences(state => state.setPracticeDefaults)
  const count = Math.min(limit, collection?.sentenceCount ?? 0)

  return (
    <Dialog open={collection !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="dialog-scroll gap-6 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Practice session</DialogTitle>
          <DialogDescription className="text-base">{collection?.name}</DialogDescription>
        </DialogHeader>
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-3 text-sm font-semibold">Practice type</legend>
          <RadioGroup value="reading" aria-label="Practice type" className="grid gap-3 sm:grid-cols-2">
            {PRACTICE_ACTIVITY_OPTIONS.map(({ value, label, icon: Icon, description, available }) => (
              <Label
                key={value}
                htmlFor={`activity-${value}`}
                className="selection-card p-3"
                data-selected={available}
                data-disabled={!available}
              >
                <RadioGroupItem
                  id={`activity-${value}`}
                  value={value}
                  aria-label={label}
                  disabled={!available}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  <span className="block text-xs leading-5 font-normal">{description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-3 text-sm font-semibold">How would you like to practice?</legend>
          <RadioGroup
            value={mode}
            onValueChange={value => setPracticeDefaults(practiceModeFromValue(value), limit)}
            aria-label="Practice mode"
            className="gap-3"
          >
            {PRACTICE_MODE_OPTIONS.map(({ value, label, icon: Icon, badge, description }) => (
              <Label
                key={value}
                htmlFor={`mode-${value}`}
                className="selection-card"
                data-selected={mode === value}
              >
                <RadioGroupItem
                  value={value}
                  id={`mode-${value}`}
                  aria-label={label}
                  aria-describedby={`mode-${value}-description`}
                />
                <Icon className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{label}</span>
                    <Badge variant="secondary">{badge}</Badge>
                  </span>
                  <span
                    id={`mode-${value}-description`}
                    className="block text-sm leading-relaxed font-normal text-muted-foreground"
                  >
                    {description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <Label htmlFor="session-size" className="flex items-center gap-2">
            <Rows3 className="size-4 text-muted-foreground" />
            Sentences per session
          </Label>
          <Select
            items={limitItems}
            value={String(limit)}
            onValueChange={value => setPracticeDefaults(mode, sessionLimitFromValue(value))}
          >
            <SelectTrigger id="session-size" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="flex w-full items-center gap-2 text-xs text-muted-foreground">
            <Shuffle className="size-3.5 shrink-0" />
            {count} random {count === 1 ? 'sentence' : 'sentences'} from this collection.
          </p>
        </div>
        <DialogFooter className="sticky bottom-0 bg-background pt-2">
          <Button
            className="w-full"
            size="lg"
            disabled={!count || !collection}
            onClick={() =>
              collection &&
              void navigate({
                to: '/dashboard/collections/$collectionId/practice',
                params: { collectionId: collection.id },
                search: { mode, limit },
              })
            }
          >
            Start session
            <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
