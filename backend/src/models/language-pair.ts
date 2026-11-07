import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose'

const languagePairSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    targetLanguage: { type: Schema.Types.ObjectId, ref: 'Language', required: true },
    baseLanguage: { type: Schema.Types.ObjectId, ref: 'Language', required: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    totalSentences: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export type LanguagePairFields = InferSchemaType<typeof languagePairSchema>
export type LanguagePairDocument = HydratedDocument<LanguagePairFields>
export const LanguagePair = model('LanguagePair', languagePairSchema)
