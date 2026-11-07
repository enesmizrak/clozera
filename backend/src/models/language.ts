import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose'

const languageSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    iso3: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    nativeName: { type: String, required: true, trim: true },
    flagIso: { type: String, required: true, trim: true },
    rtl: { type: Boolean, default: false },
    ttsLocale: { type: String, default: '' },
  },
  { timestamps: true }
)

export type LanguageFields = InferSchemaType<typeof languageSchema>
export type LanguageDocument = HydratedDocument<LanguageFields>
export const Language = model('Language', languageSchema)
