import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose'

const collectionGroupSchema = new Schema(
  {
    languagePair: { type: Schema.Types.ObjectId, ref: 'LanguagePair', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

collectionGroupSchema.index({ languagePair: 1, order: 1 })

export type CollectionGroupFields = InferSchemaType<typeof collectionGroupSchema>
export type CollectionGroupDocument = HydratedDocument<CollectionGroupFields>
export const CollectionGroup = model('CollectionGroup', collectionGroupSchema)
