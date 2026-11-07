import { z } from 'zod'
import { COLLECTION_TYPES, VISIBILITIES } from './contracts.ts'
import { extractCloze, normalizeList } from './sentence-authoring.ts'

/** Validation schemas shared by API request parsing and frontend forms. */

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)

const optionalText = (max: number) => z.string().trim().max(max).default('')

const answerList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform(value => normalizeList(value))

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.')

export const emailSchema = z.email('Enter a valid email address.').trim().toLowerCase()

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be at most 30 characters.')
  .regex(/^[a-z0-9_.]+$/, 'Use only letters, numbers, dots and underscores.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
})
export type LoginInput = z.input<typeof loginSchema>

export const signUpSchema = z.object({
  name: requiredText('Name', 80),
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})
export type SignUpInput = z.input<typeof signUpSchema>

export const profileUpdateSchema = z
  .object({
    name: requiredText('Name', 80),
    username: usernameSchema,
    timezone: z.string().trim().min(1).max(64),
    selectedLanguagePairSlug: z.string().trim().min(1),
  })
  .partial()
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export const visibilitySchema = z.enum(VISIBILITIES, { error: 'Visibility must be public or private.' })

export const collectionFormSchema = z.object({
  name: requiredText('Collection name', 120),
  description: optionalText(1000),
  visibility: visibilitySchema,
})
export type CollectionFormInput = z.input<typeof collectionFormSchema>

export const collectionCreateSchema = collectionFormSchema.extend({
  visibility: visibilitySchema.default('private'),
  languagePairSlug: z.string().trim().min(1).optional(),
  type: z.enum(COLLECTION_TYPES).default('topic'),
  level: optionalText(40),
})
export type CollectionCreateInput = z.input<typeof collectionCreateSchema>

export const collectionUpdateSchema = collectionFormSchema.partial()
export type CollectionUpdateInput = z.input<typeof collectionUpdateSchema>

export const sentenceSchema = z.object({
  text: requiredText('Sentence', 1000).refine(text => extractCloze(text) !== '', {
    message: 'Mark exactly one missing word or phrase with {{double braces}}.',
  }),
  translation: requiredText('Translation', 1000),
  alternativeAnswers: answerList,
  multipleChoiceOptions: answerList,
  hint: optionalText(300),
  notes: optionalText(2000),
})
export type SentenceInput = z.input<typeof sentenceSchema>
export type SentencePayload = z.output<typeof sentenceSchema>

export const pinCollectionSchema = z.object({ collectionId: objectIdSchema })

const page = z.coerce.number().int().min(1).catch(1)
const perPage = z.coerce.number().int().min(1).max(100).catch(20)

export const listCollectionsQuerySchema = z.object({
  languagePair: z.string().trim().min(1).optional(),
  owner: z.literal('me').optional().catch(undefined),
  page,
  perPage,
})

export const listSentencesQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  context: z.enum(['text', 'translation', 'cloze']).catch('text'),
  page,
  perPage,
})

export const dashboardQuerySchema = z.object({
  languagePair: z.string().trim().min(1).optional(),
})
