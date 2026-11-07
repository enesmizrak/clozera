import type {
  CollectionDto,
  CollectionGroupDto,
  LanguageDto,
  LanguagePairDto,
  LanguagePairSummaryDto,
  SentenceDto,
  UserDto,
} from '@clozera/shared'
import type { CollectionDocument } from '../models/collection.ts'
import type { CollectionGroupFields } from '../models/collection-group.ts'
import type { CollectionSentenceDocument } from '../models/collection-sentence.ts'
import type { LanguageFields } from '../models/language.ts'
import type { LanguagePairFields } from '../models/language-pair.ts'
import type { UserDocument, UserFields } from '../models/user.ts'
import {
  collectionCapabilities,
  collectionRelationship,
  isCollectionPinned,
  type Viewer,
} from './collection-capabilities.ts'
import { isPopulated, type Ref } from './refs.ts'

/** A reference field as Mongoose types it before population. */
type Populated = unknown

export function serializeLanguage(language: LanguageFields & { _id: unknown }): LanguageDto {
  return {
    id: String(language._id),
    code: language.code,
    iso3: language.iso3,
    name: language.name,
    nativeName: language.nativeName,
    flagIso: language.flagIso,
    rtl: language.rtl,
    ttsLocale: language.ttsLocale,
  }
}

export function serializeLanguagePairSummary(pair: Populated): LanguagePairSummaryDto | null {
  if (!isPopulated(pair as Ref<LanguagePairFields>)) return null
  const { _id, slug, name } = pair as LanguagePairFields & { _id: unknown }
  return { id: String(_id), slug, name }
}

export function serializeLanguagePair(pair: LanguagePairFields & { _id: unknown }): LanguagePairDto {
  return {
    id: String(pair._id),
    slug: pair.slug,
    name: pair.name,
    active: pair.active,
    targetLanguage: serializeLanguage(pair.targetLanguage as unknown as LanguageFields & { _id: unknown }),
    baseLanguage: serializeLanguage(pair.baseLanguage as unknown as LanguageFields & { _id: unknown }),
  }
}

export function serializeUser(user: UserDocument): UserDto {
  return {
    id: user.id as string,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    selectedLanguagePair: serializeLanguagePairSummary(user.selectedLanguagePair),
    languagePairs: user.languagePairs.map(serializeLanguagePairSummary).filter(pair => pair !== null),
  }
}

function serializeGroup(group: Populated): CollectionGroupDto | null {
  if (!isPopulated(group as Ref<CollectionGroupFields>)) return null
  const { _id, name, type, description, order } = group as CollectionGroupFields & { _id: unknown }
  return { id: String(_id), name, type, description, order }
}

export function serializeCollection(collection: CollectionDocument, viewer: Viewer | null): CollectionDto {
  const relationship = collectionRelationship(collection, viewer)
  const owner = collection.owner as Ref<UserFields>

  return {
    id: String(collection._id),
    name: collection.name,
    slug: collection.slug,
    description: collection.description,
    type: collection.type,
    level: collection.level,
    sentenceCount: collection.sentenceCount,
    isOfficial: collection.isOfficial,
    isPublic: collection.isPublic,
    visibility: collection.isPublic ? 'public' : 'private',
    relationship,
    isPinned: isCollectionPinned(collection, viewer),
    capabilities: collectionCapabilities(collection, viewer),
    languagePair: serializeLanguagePairSummary(collection.languagePair),
    group: serializeGroup(collection.group),
    // Community collections credit their creator without exposing private identity details.
    ...(relationship === 'community' && isPopulated(owner)
      ? { creator: { id: String(owner._id), displayName: owner.name || owner.username } }
      : {}),
  }
}

export function serializeSentence(sentence: CollectionSentenceDocument): SentenceDto {
  return {
    id: String(sentence._id),
    text: sentence.text,
    translation: sentence.translation,
    cloze: sentence.cloze,
    alternativeAnswers: sentence.alternativeAnswers,
    multipleChoiceOptions: sentence.multipleChoiceOptions,
    hint: sentence.hint,
    notes: sentence.notes,
  }
}
