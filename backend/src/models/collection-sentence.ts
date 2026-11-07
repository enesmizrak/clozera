import { extractCloze } from '@clozera/shared'
import { type HydratedDocument, type InferSchemaType, type UpdateQuery, Schema, model } from 'mongoose'

const collectionSentenceSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    collection: { type: Schema.Types.ObjectId, ref: 'Collection', required: true, index: true },
    text: { type: String, required: true, trim: true },
    translation: { type: String, required: true, trim: true },
    cloze: { type: String, required: true, trim: true },
    alternativeAnswers: [{ type: String, trim: true }],
    multipleChoiceOptions: [{ type: String, trim: true }],
    hint: { type: String, default: '' },
    notes: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
)

collectionSentenceSchema.index({ collection: 1, order: 1 })
collectionSentenceSchema.index({ collection: 1, cloze: 1 })

// The cloze answer is derived from the `{{marker}}` in the text; keep both in sync on every write path.
collectionSentenceSchema.pre('validate', function syncClozeFromText() {
  if (this.isModified('text') || !this.cloze) {
    this.cloze = extractCloze(this.text)
  }
})

collectionSentenceSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function syncUpdatedCloze() {
  const update = this.getUpdate() as UpdateQuery<{ text: string; cloze: string }> | null
  if (!update) return
  if (typeof update.text === 'string') update.cloze = extractCloze(update.text)
  if (typeof update.$set?.text === 'string') update.$set.cloze = extractCloze(update.$set.text)
  this.setUpdate(update)
})

export type CollectionSentenceFields = InferSchemaType<typeof collectionSentenceSchema>
export type CollectionSentenceDocument = HydratedDocument<CollectionSentenceFields>
export const CollectionSentence = model('CollectionSentence', collectionSentenceSchema)
