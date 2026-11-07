import { Types } from 'mongoose'
import { describe, expect, it } from 'vite-plus/test'
import {
  collectionAccessConditions,
  collectionCapabilities,
  collectionRelationship,
  pinnedCollectionIds,
} from './collection-capabilities.ts'

const owner = { _id: new Types.ObjectId(), pinnedCollections: [] as Types.ObjectId[] }
const other = { _id: new Types.ObjectId(), pinnedCollections: [] as Types.ObjectId[] }

describe('collection capabilities', () => {
  it('derives relationships from official status and ownership', () => {
    const official = { _id: new Types.ObjectId(), owner: owner._id, isOfficial: true }
    const learnerCollection = { _id: new Types.ObjectId(), owner: owner._id, isOfficial: false }

    expect(collectionRelationship(official, owner)).toBe('official')
    expect(collectionRelationship(learnerCollection, owner)).toBe('owned')
    expect(collectionRelationship(learnerCollection, other)).toBe('community')
  })

  it('only lets owners edit their non-official collections', () => {
    const collection = { _id: new Types.ObjectId(), owner: { _id: owner._id }, isOfficial: false }

    expect(collectionCapabilities(collection, owner)).toMatchObject({ canEdit: true, canDelete: true })
    expect(collectionCapabilities(collection, other)).toMatchObject({ canEdit: false, canDelete: false })
    expect(collectionCapabilities({ ...collection, isOfficial: true }, owner).canEdit).toBe(false)
  })

  it('reports pin capabilities from the viewer pins', () => {
    const collection = { _id: new Types.ObjectId(), owner: owner._id, isOfficial: true }
    const viewer = { ...other, pinnedCollections: [collection._id] }

    expect(pinnedCollectionIds(viewer)).toEqual(new Set([String(collection._id)]))
    expect(collectionCapabilities(collection, viewer)).toMatchObject({ canPin: false, canUnpin: true })
    expect(collectionCapabilities(collection, other)).toMatchObject({ canPin: true, canUnpin: false })
  })

  it('limits access to public collections and the viewer’s own collections', () => {
    expect(collectionAccessConditions(owner)).toEqual([{ isPublic: true }, { owner: owner._id }])
    expect(collectionAccessConditions(null)).toEqual([{ isPublic: true }])
  })
})
