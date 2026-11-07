import type { CollectionCapabilities, CollectionRelationship } from '@clozera/shared'
import type { Types } from 'mongoose'
import { type Ref, refId } from './refs.ts'

export interface Viewer {
  _id: Types.ObjectId
  pinnedCollections?: ReadonlyArray<Ref<unknown>>
}

export interface CollectionAccessFields {
  _id: Types.ObjectId
  owner?: Ref<unknown>
  isOfficial?: boolean | null
}

export function pinnedCollectionIds(viewer: Viewer | null | undefined): Set<string> {
  return new Set((viewer?.pinnedCollections ?? []).map(id => refId(id)).filter(id => id !== null))
}

export function isCollectionPinned(collection: CollectionAccessFields, viewer: Viewer | null | undefined) {
  return pinnedCollectionIds(viewer).has(String(collection._id))
}

/** Mongo filter for collections a viewer may read: public ones and their own private ones. */
export function collectionAccessConditions(viewer: Viewer | null | undefined) {
  return viewer ? [{ isPublic: true }, { owner: viewer._id }] : [{ isPublic: true }]
}

function isOwner(collection: CollectionAccessFields, viewer: Viewer | null | undefined) {
  return Boolean(viewer && refId(collection.owner) === String(viewer._id))
}

export function collectionRelationship(
  collection: CollectionAccessFields,
  viewer: Viewer | null | undefined
): CollectionRelationship {
  if (collection.isOfficial) return 'official'
  return isOwner(collection, viewer) ? 'owned' : 'community'
}

export function collectionCapabilities(
  collection: CollectionAccessFields,
  viewer: Viewer | null | undefined
): CollectionCapabilities {
  const isPinned = isCollectionPinned(collection, viewer)
  const canEdit = !collection.isOfficial && isOwner(collection, viewer)

  return { canEdit, canDelete: canEdit, canChangeVisibility: canEdit, canPin: !isPinned, canUnpin: isPinned }
}
