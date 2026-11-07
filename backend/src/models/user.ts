import { USER_ROLES } from '@clozera/shared'
import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose'

/**
 * Better Auth owns the identity fields of this collection (name, email, username, emailVerified, image)
 * and writes them through its MongoDB adapter. Mongoose reads them and owns the learning-domain fields.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayUsername: { type: String, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    timezone: { type: String, default: 'UTC', trim: true },
    selectedLanguagePair: { type: Schema.Types.ObjectId, ref: 'LanguagePair', default: null },
    languagePairs: { type: [{ type: Schema.Types.ObjectId, ref: 'LanguagePair' }], default: [] },
    pinnedCollections: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
      default: [],
      index: true,
    },
    // passport-local-mongoose credentials kept until `npm run auth:migrate-legacy` moves them to Better Auth.
    hash: { type: String, select: false },
    salt: { type: String, select: false },
  },
  { timestamps: true, collection: 'users' }
)

export type UserFields = InferSchemaType<typeof userSchema>
export type UserDocument = HydratedDocument<UserFields>
export const User = model('User', userSchema)
