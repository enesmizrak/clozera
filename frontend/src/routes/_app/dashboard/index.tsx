import type { CollectionDto } from '@clozera/shared'
import { eq, useLiveQuery } from '@tanstack/react-db'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, BookOpen, LayoutDashboard, Library, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { CollectionCard } from '@/components/collection-card'
import { CollectionForm } from '@/components/collection-form'
import { LibraryChart } from '@/components/library-chart'
import { PageSpinner } from '@/components/page-status'
import { PracticeDialog } from '@/components/practice-dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createLearnerCollection, libraryCollection } from '@/data/collections'
import { useSearchDraft } from '@/hooks/use-search-draft'
import {
  buildCollectionShelves,
  countShelfCollections,
  filterCollectionShelves,
  sortCollections,
} from '@/lib/collection-shelves'
import { type CollectionSort, usePreferences } from '@/stores/preferences'

// Optional so plain links to /dashboard stay valid; defaults are applied when reading.
const dashboardSearchSchema = z.object({
  tab: z.enum(['dashboard', 'collections']).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_app/dashboard/')({
  validateSearch: dashboardSearchSchema,
  loader: async ({ context }) => {
    const languagePair = context.user.selectedLanguagePair?.slug ?? ''
    await libraryCollection(languagePair).preload()
    return { languagePair }
  },
  head: () => ({ meta: [{ title: 'Dashboard · Clozera' }] }),
  component: DashboardPage,
})

const sortItems = [
  { value: 'name', label: 'Name: A–Z' },
  { value: 'sentences', label: 'Most sentences' },
]

function CollectionGrid({
  collections,
  sort,
  onPractice,
}: {
  collections: readonly CollectionDto[]
  sort: CollectionSort
  onPractice: (collection: CollectionDto) => void
}) {
  return (
    <ul className="collection-grid">
      {sortCollections(collections, sort).map(collection => (
        <li key={collection.id}>
          <CollectionCard collection={collection} onPractice={onPractice} />
        </li>
      ))}
    </ul>
  )
}

function DashboardPage() {
  const { languagePair } = Route.useLoaderData()
  const search = Route.useSearch()
  const tab = search.tab ?? 'dashboard'
  const query = search.q ?? ''
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (next: Partial<z.infer<typeof dashboardSearchSchema>>) =>
    void navigate({ search: previous => ({ ...previous, ...next }), replace: true })
  // The input follows the keystrokes; the URL catches up after a pause (or changes from outside, e.g. back).
  const {
    draft,
    onType,
    clear: clearSearch,
  } = useSearchDraft(query, value => setSearch({ q: value || undefined }))
  const sort = usePreferences(state => state.collectionSort)
  const setSort = usePreferences(state => state.setCollectionSort)
  const expandedGroupIds = usePreferences(state => state.expandedGroupIds)
  const setExpandedGroupIds = usePreferences(state => state.setExpandedGroupIds)
  const [creating, setCreating] = useState(false)
  const [practice, setPractice] = useState<CollectionDto | null>(null)

  const library = libraryCollection(languagePair)
  const { data: collections, isLoading } = useLiveQuery({ query: q => q.from({ collection: library }) })
  const { data: pinnedCollections } = useLiveQuery({
    query: q => q.from({ collection: library }).where(({ collection }) => eq(collection.isPinned, true)),
  })

  const normalizedQuery = draft.trim().toLowerCase()
  const pinned = pinnedCollections.filter(collection =>
    collection.name.toLowerCase().includes(normalizedQuery)
  )
  const shelves = filterCollectionShelves(buildCollectionShelves(collections), draft)
  const visibleCount = tab === 'dashboard' ? pinned.length : countShelfCollections(shelves)

  return (
    <>
      <main className="page-shell space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">
              Your learning space
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {tab === 'dashboard' ? 'Your dashboard' : 'Collections'}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {tab === 'dashboard'
                ? 'Your pinned collections, ready for a quick practice session.'
                : 'Find a collection, explore its sentences, and choose how to practice.'}
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New collection
          </Button>
        </header>

        <Tabs value={tab} onValueChange={value => setSearch({ tab: value as typeof tab })}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
            <TabsList aria-label="Dashboard sections">
              <TabsTrigger value="dashboard">
                <LayoutDashboard />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="collections">
                <Library />
                Collections
              </TabsTrigger>
            </TabsList>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isLoading
                ? 'Loading collections…'
                : `${visibleCount} ${visibleCount === 1 ? 'collection' : 'collections'}${normalizedQuery ? ' found' : ''}`}
            </p>
          </div>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search collections"
              placeholder="Search collections…"
              value={draft}
              onChange={event => onType(event.target.value)}
            />
            {draft && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={clearSearch}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select
            items={sortItems}
            value={sort}
            onValueChange={value => value && setSort(value as CollectionSort)}
          >
            <SelectTrigger aria-label="Sort collections" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortItems.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <PageSpinner label="Loading collections…" />
        ) : tab === 'dashboard' ? (
          pinned.length ? (
            <div className="space-y-8">
              <CollectionGrid collections={pinned} sort={sort} onPractice={setPractice} />
              {!normalizedQuery && <LibraryChart collections={pinnedCollections} />}
            </div>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>{draft ? 'No matches found.' : 'No pinned collections yet.'}</EmptyTitle>
                <EmptyDescription>
                  {draft
                    ? 'Try a different collection name.'
                    : 'Add collections to your dashboard from the Collections tab.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={() => (draft ? clearSearch() : setSearch({ tab: 'collections' }))}
                >
                  {draft ? 'Clear search' : 'Explore collections'}
                  <ArrowRight />
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : shelves.length ? (
          shelves.map(shelf => (
            <section key={shelf.id} className="space-y-4" aria-label={shelf.name}>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{shelf.name}</h2>
                <Badge variant="outline">{countShelfCollections([shelf])}</Badge>
              </div>
              {shelf.relationship === 'official' ? (
                <Accordion
                  multiple
                  value={expandedGroupIds}
                  onValueChange={ids => setExpandedGroupIds(ids as string[])}
                >
                  {shelf.groups.map(group => (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger>
                        <span>
                          {group.name}
                          <span className="ml-3 text-sm font-normal text-muted-foreground">
                            {group.collections.length} collections ·{' '}
                            {group.collections.reduce(
                              (total, collection) => total + collection.sentenceCount,
                              0
                            )}{' '}
                            sentences
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <CollectionGrid
                          collections={group.collections}
                          sort={sort}
                          onPractice={setPractice}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <CollectionGrid
                  collections={shelf.groups.flatMap(group => group.collections)}
                  sort={sort}
                  onPractice={setPractice}
                />
              )}
            </section>
          ))
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle>{draft ? 'No matches found.' : 'No collections yet.'}</EmptyTitle>
              <EmptyDescription>
                {draft
                  ? 'Try a different collection name.'
                  : 'Create the first collection for this language pair.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => (draft ? clearSearch() : setCreating(true))}>
                {draft ? 'Clear search' : 'Create a collection'}
                <ArrowRight />
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </main>

      <PracticeDialog collection={practice} onClose={() => setPractice(null)} />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>Create a collection for your selected language pair.</DialogDescription>
          </DialogHeader>
          <CollectionForm
            onSubmit={async input => {
              await createLearnerCollection(languagePair, { ...input, type: 'topic' })
              setCreating(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
