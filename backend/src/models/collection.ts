import { COLLECTION_TYPES } from '@clozera/shared'
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose'

const collectionSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    languagePair: { type: Schema.Types.ObjectId, ref: 'LanguagePair', required: true, index: true },
    group: { type: Schema.Types.ObjectId, ref: 'CollectionGroup', default: null, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: COLLECTION_TYPES, default: 'fast_track' },
    level: { type: String, default: '' },
    isOfficial: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    sentenceCount: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

collectionSchema.index({ languagePair: 1, type: 1, order: 1 })
collectionSchema.index({ languagePair: 1, slug: 1 }, { unique: true })

export type CollectionFields = InferSchemaType<typeof collectionSchema>
export type CollectionDocument = HydratedDocument<CollectionFields>
export const Collection = model('Collection', collectionSchema)
