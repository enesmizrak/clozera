import type { CollectionDto, CollectionGroupDto, CollectionRelationship } from '@clozera/shared'

export interface ShelfGroup extends CollectionGroupDto {
  collections: CollectionDto[]
}

export interface Shelf {
  id: CollectionRelationship
  name: string
  relationship: CollectionRelationship
  groups: ShelfGroup[]
}

const FALLBACK_GROUP: CollectionGroupDto = {
  id: 'ungrouped',
  name: 'Collections',
  type: 'ungrouped',
  description: '',
  order: Number.MAX_SAFE_INTEGER,
}

const SHELVES = [
  { id: 'official', name: 'Official', relationship: 'official' },
  { id: 'owned', name: 'My Collections', relationship: 'owned' },
  { id: 'community', name: 'Community', relationship: 'community' },
] as const satisfies ReadonlyArray<Omit<Shelf, 'groups'>>

function sortGroups(left: ShelfGroup, right: ShelfGroup): number {
  return left.order - right.order || left.name.localeCompare(right.name)
}

/** Official collections are grouped by track; learner shelves are flat. */
function officialGroups(collections: CollectionDto[]): ShelfGroup[] {
  const groups = new Map<string, ShelfGroup>()
  for (const collection of collections) {
    const group = collection.group ?? FALLBACK_GROUP
    const existing = groups.get(group.id)
    if (existing) existing.collections.push(collection)
    else groups.set(group.id, { ...group, collections: [collection] })
  }
  return [...groups.values()].sort(sortGroups)
}

export function buildCollectionShelves(collections: readonly CollectionDto[] = []): Shelf[] {
  return SHELVES.map(shelf => {
    const shelfCollections = collections.filter(collection => collection.relationship === shelf.relationship)
    const groups =
      shelf.relationship === 'official'
        ? officialGroups(shelfCollections)
        : [
            {
              id: shelf.id,
              name: shelf.name,
              type: shelf.relationship,
              description: '',
              order: 0,
              collections: shelfCollections,
            },
          ]
    return { ...shelf, groups }
  }).filter(shelf => shelf.groups.some(group => group.collections.length > 0))
}

export function filterCollectionShelves(shelves: readonly Shelf[], query: string): Shelf[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return [...shelves]

  return shelves
    .map(shelf => ({
      ...shelf,
      groups: shelf.groups
        .map(group => ({
          ...group,
          collections: group.name.toLowerCase().includes(normalizedQuery)
            ? group.collections
            : group.collections.filter(collection => collection.name.toLowerCase().includes(normalizedQuery)),
        }))
        .filter(group => group.collections.length > 0),
    }))
    .filter(shelf => shelf.groups.length > 0)
}

export function countShelfCollections(shelves: readonly Shelf[]): number {
  return shelves.reduce(
    (total, shelf) => total + shelf.groups.reduce((sum, group) => sum + group.collections.length, 0),
    0
  )
}

export function sortCollections(
  collections: readonly CollectionDto[],
  sort: 'name' | 'sentences'
): CollectionDto[] {
  return collections.toSorted((left, right) =>
    sort === 'sentences'
      ? right.sentenceCount - left.sentenceCount || left.name.localeCompare(right.name)
      : left.name.localeCompare(right.name)
  )
}
