import type { SentenceDto } from '@clozera/shared'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { PinButton } from '@/components/collection-card'
import { CollectionForm } from '@/components/collection-form'
import { Markdown } from '@/components/markdown'
import { PracticeDialog } from '@/components/practice-dialog'
import { SentenceForm } from '@/components/sentence-form'
import { SentencesTable } from '@/components/sentences-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  addSentence,
  deleteCollection,
  editSentence,
  removeSentence,
  saveCollectionDetails,
} from '@/data/collections'
import { errorMessage } from '@/lib/api'
import { useCollectionSentences, useCurrentCollection } from './route'

export const Route = createFileRoute('/_app/dashboard/collections/$collectionId/')({
  component: CollectionPage,
})

type Editing = { kind: 'collection' } | { kind: 'sentence'; sentence: SentenceDto | null } | null

function CollectionPage() {
  const collection = useCurrentCollection()
  const { sentences } = useCollectionSentences()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sentenceToDelete, setSentenceToDelete] = useState<SentenceDto | null>(null)
  const [practicing, setPracticing] = useState(false)
  const canEdit = collection.capabilities.canEdit

  const onEditSentence = useCallback(
    (sentence: SentenceDto) => setEditing({ kind: 'sentence', sentence }),
    []
  )
  const onDeleteSentence = useCallback((sentence: SentenceDto) => setSentenceToDelete(sentence), [])

  async function removeCollection() {
    try {
      await deleteCollection(collection)
      toast.success(`Deleted ${collection.name}.`)
      await navigate({ to: '/dashboard' })
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to delete this collection.'))
    }
  }

  return (
    <>
      <main className="page-shell space-y-7">
        <Link to="/dashboard" className={buttonVariants({ variant: 'ghost' })}>
          <ArrowLeft />
          Back to dashboard
        </Link>
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:justify-between">
            <div className="space-y-3">
              {collection.level && <Badge variant="secondary">{collection.level}</Badge>}
              <CardTitle className="text-3xl">
                <h1>{collection.name}</h1>
              </CardTitle>
              <CardDescription>
                {collection.description ? (
                  <Markdown>{collection.description}</Markdown>
                ) : (
                  'Focused cloze practice collection.'
                )}
              </CardDescription>
              <p className="text-sm text-muted-foreground">{collection.sentenceCount} sentences</p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <Button disabled={!collection.sentenceCount} onClick={() => setPracticing(true)}>
                <Play />
                Practice
              </Button>
              <PinButton collection={collection} />
              {canEdit && (
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Edit collection"
                  onClick={() => setEditing({ kind: 'collection' })}
                >
                  <Pencil />
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        <section aria-label="Collection sentences" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Sentences</h2>
            {canEdit && (
              <Button onClick={() => setEditing({ kind: 'sentence', sentence: null })}>
                <Plus />
                Add sentence
              </Button>
            )}
          </div>
          <SentencesTable
            sentences={sentences}
            canEdit={canEdit}
            onEdit={onEditSentence}
            onDelete={onDeleteSentence}
          />
        </section>
      </main>

      {practicing && <PracticeDialog collection={collection} onClose={() => setPracticing(false)} />}

      <Dialog open={editing !== null} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="dialog-scroll">
          <DialogHeader>
            <DialogTitle>
              {editing?.kind === 'collection'
                ? 'Edit collection'
                : editing?.sentence
                  ? 'Edit sentence'
                  : 'New sentence'}
            </DialogTitle>
            <DialogDescription>
              {editing?.kind === 'collection'
                ? 'Update the collection details and visibility.'
                : 'Write a sentence and mark one answer with double braces.'}
            </DialogDescription>
          </DialogHeader>
          {editing?.kind === 'collection' && (
            <CollectionForm
              collection={collection}
              onSubmit={async input => {
                await saveCollectionDetails(collection, input)
                setEditing(null)
              }}
            >
              {collection.capabilities.canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                  Delete collection
                </Button>
              )}
            </CollectionForm>
          )}
          {editing?.kind === 'sentence' && (
            <SentenceForm
              key={editing.sentence?.id ?? 'new'}
              sentence={editing.sentence}
              onSubmit={async input => {
                if (editing.sentence) await editSentence(collection, editing.sentence.id, input)
                else await addSentence(collection, input)
                setEditing(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {collection.name} and its sentences. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void removeCollection()}>
              Delete collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sentenceToDelete !== null} onOpenChange={open => !open && setSentenceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sentence?</AlertDialogTitle>
            <AlertDialogDescription>{sentenceToDelete?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!sentenceToDelete) return
                setSentenceToDelete(null)
                removeSentence(collection, sentenceToDelete.id).catch((error: unknown) =>
                  toast.error(errorMessage(error, 'Unable to delete this sentence.'))
                )
              }}
            >
              Delete sentence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
