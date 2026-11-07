/**
 * Response shapes returned by the Clozera API. The backend serializes to these types
 * and the frontend consumes them, so a contract change fails type checking on both sides.
 */

export const COLLECTION_RELATIONSHIPS = ['official', 'owned', 'community'] as const
export type CollectionRelationship = (typeof COLLECTION_RELATIONSHIPS)[number]

export const COLLECTION_TYPES = ['fast_track', 'cefr', 'topic'] as const
export type CollectionType = (typeof COLLECTION_TYPES)[number]

export const VISIBILITIES = ['public', 'private'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface LanguageDto {
  id: string
  code: string
  iso3: string
  name: string
  nativeName: string
  flagIso: string
  rtl: boolean
  ttsLocale: string
}

export interface LanguagePairSummaryDto {
  id: string
  slug: string
  name: string
}

export interface LanguagePairDto extends LanguagePairSummaryDto {
  active: boolean
  targetLanguage: LanguageDto
  baseLanguage: LanguageDto
}

export interface UserDto {
  id: string
  name: string
  username: string
  email: string
  role: UserRole
  timezone: string
  selectedLanguagePair: LanguagePairSummaryDto | null
  languagePairs: LanguagePairSummaryDto[]
}

export interface CollectionCapabilities {
  canEdit: boolean
  canDelete: boolean
  canChangeVisibility: boolean
  canPin: boolean
  canUnpin: boolean
}

export interface CollectionGroupDto {
  id: string
  name: string
  type: string
  description: string
  order: number
}

export interface CollectionCreatorDto {
  id: string
  displayName: string
}

export interface CollectionDto {
  id: string
  name: string
  slug: string
  description: string
  type: CollectionType
  level: string
  sentenceCount: number
  isOfficial: boolean
  isPublic: boolean
  visibility: Visibility
  relationship: CollectionRelationship
  isPinned: boolean
  capabilities: CollectionCapabilities
  languagePair: LanguagePairSummaryDto | null
  group?: CollectionGroupDto | null
  creator?: CollectionCreatorDto | null
}

export interface SentenceDto {
  id: string
  text: string
  translation: string
  cloze: string
  alternativeAnswers: string[]
  multipleChoiceOptions: string[]
  hint: string
  notes: string
}

export interface PageMeta {
  total: number
  page: number
  perPage: number
}

export interface ApiData<T> {
  data: T
}

export interface ApiPage<K extends string, T> {
  data: Record<K, T[]>
  meta: PageMeta
}

export interface ApiFieldIssue {
  field: string
  message: string
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: ApiFieldIssue[]
  }
}
