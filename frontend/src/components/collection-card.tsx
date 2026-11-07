import type { CollectionDto } from '@clozera/shared'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Layers, LockKeyhole, Pin, PinOff, Play, Rows3, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { togglePinned } from '@/data/collections'
import { errorMessage } from '@/lib/api'

const relationshipLabels = {
  official: { label: 'Official', icon: BookOpen },
  owned: { label: 'My collection', icon: Layers },
  community: { label: 'Community', icon: Users },
} as const

export function PinButton({ collection, className }: { collection: CollectionDto; className?: string }) {
  if (!collection.capabilities.canPin && !collection.capabilities.canUnpin) return null
  const label = collection.isPinned ? 'Remove from dashboard' : 'Add to dashboard'
  return (
    <Button
      size="icon"
      variant="ghost"
      className={className}
      aria-label={`${label}: ${collection.name}`}
      title={label}
      aria-pressed={collection.isPinned}
      onClick={() => {
        togglePinned(collection).catch((error: unknown) =>
          toast.error(errorMessage(error, 'Unable to update your dashboard.'))
        )
      }}
    >
      {collection.isPinned ? <PinOff /> : <Pin />}
    </Button>
  )
}

export function CollectionCard({
  collection,
  onPractice,
}: {
  collection: CollectionDto
  onPractice: (collection: CollectionDto) => void
}) {
  const { label, icon: Icon } = relationshipLabels[collection.relationship]
  const count = collection.sentenceCount

  return (
    <Card className="group h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
      <CardHeader className="gap-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Icon />
              {label}
            </Badge>
            {collection.level && <Badge variant="outline">{collection.level.replaceAll('_', ' ')}</Badge>}
          </div>
          <PinButton collection={collection} className="shrink-0 text-muted-foreground" />
        </div>
        <Link
          to="/dashboard/collections/$collectionId"
          params={{ collectionId: collection.id }}
          className="min-w-0 space-y-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardTitle className="line-clamp-2 text-xl">
            <h3>{collection.name}</h3>
          </CardTitle>
          <CardDescription className="line-clamp-2 min-h-10">
            {collection.description || 'Build your vocabulary with sentences in context.'}
          </CardDescription>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-1 flex-wrap items-start justify-between gap-2 pb-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Rows3 className="size-4" />
          {count.toLocaleString('en-US')} {count === 1 ? 'sentence' : 'sentences'}
        </p>
        {collection.relationship === 'community' && collection.creator ? (
          <p className="max-w-full truncate">by {collection.creator.displayName}</p>
        ) : (
          collection.visibility === 'private' && (
            <p className="flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" />
              Private
            </p>
          )
        )}
      </CardContent>
      <CardFooter className="flex gap-2 border-t bg-muted/30 py-4">
        <Button className="flex-1" disabled={!count} onClick={() => onPractice(collection)}>
          <Play />
          {count ? 'Practice' : 'No sentences yet'}
        </Button>
        <Link
          to="/dashboard/collections/$collectionId"
          params={{ collectionId: collection.id }}
          aria-label={`View sentences in ${collection.name}`}
          title="View sentences"
          className={buttonVariants({ variant: 'outline', size: 'icon' })}
        >
          <ArrowRight />
        </Link>
      </CardFooter>
    </Card>
  )
}
