#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Collection } from '../src/models/collection.ts'
import { CollectionGroup } from '../src/models/collection-group.ts'
import { CollectionSentence } from '../src/models/collection-sentence.ts'
import { Language } from '../src/models/language.ts'
import { LanguagePair, type LanguagePairDocument } from '../src/models/language-pair.ts'
import { User, type UserDocument } from '../src/models/user.ts'
import { requireEnv, runScript } from './lib/run-script.ts'

interface SeedLanguage {
  code: string
  iso3: string
  [field: string]: unknown
}

interface SeedLanguagePair {
  slug: string
  name: string
  targetLanguageIso3?: string
  targetLanguageCode?: string
  baseLanguageIso3?: string
  baseLanguageCode?: string
  active?: boolean
}

interface SeedCollectionPair {
  languagePairSlug: string
  groups?: Array<{ type: string; [field: string]: unknown }>
  collections?: Array<{
    slug: string
    groupType?: string
    isOfficial?: boolean
    isPublic?: boolean
    [field: string]: unknown
  }>
  sentencesByCollectionSlug?: Record<
    string,
    Array<{ text: string; order?: number; [field: string]: unknown }>
  >
}

interface Seed {
  languages?: SeedLanguage[]
  languagePairs?: SeedLanguagePair[]
  collectionPairs?: SeedCollectionPair[]
  collections?: SeedCollectionPair
}

const seedPath =
  process.env.SEED_FILE ?? path.join(import.meta.dirname, '..', 'data', 'seeds', 'initial-seed.json')
const upsert = { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true } as const

async function resolveSeedOwner(): Promise<UserDocument> {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase()
  const admin = await User.findOne({ email })
  if (!admin) throw new Error(`Admin user not found: ${email}`)
  if (admin.role !== 'admin') throw new Error(`User is not an admin: ${email}`)
  return admin
}

async function findLanguage(identifier: string | undefined) {
  const language = identifier
    ? await Language.findOne({ $or: [{ iso3: identifier }, { code: identifier }] })
    : null
  if (!language) throw new Error(`Language not found: ${identifier}`)
  return language
}

async function upsertLanguages(languages: SeedLanguage[] = []) {
  for (const language of languages) {
    await Language.findOneAndUpdate(
      { $or: [{ code: language.code }, { iso3: language.iso3 }] },
      language,
      upsert
    )
  }
  return languages.length
}

async function upsertLanguagePairs(pairs: SeedLanguagePair[] = []) {
  for (const pair of pairs) {
    const [targetLanguage, baseLanguage] = await Promise.all([
      findLanguage(pair.targetLanguageIso3 ?? pair.targetLanguageCode),
      findLanguage(pair.baseLanguageIso3 ?? pair.baseLanguageCode),
    ])
    await LanguagePair.findOneAndUpdate(
      { slug: pair.slug },
      {
        slug: pair.slug,
        name: pair.name,
        active: pair.active ?? true,
        targetLanguage: targetLanguage._id,
        baseLanguage: baseLanguage._id,
      },
      upsert
    )
  }
  return pairs.length
}

async function upsertCollections(seed: SeedCollectionPair, owner: UserDocument) {
  const pair = await LanguagePair.findOne({ slug: seed.languagePairSlug })
  if (!pair) throw new Error(`Language pair not found: ${seed.languagePairSlug}`)

  const groupIds = new Map<string, unknown>()
  for (const group of seed.groups ?? []) {
    const saved = await CollectionGroup.findOneAndUpdate(
      { languagePair: pair._id, type: group.type },
      { ...group, languagePair: pair._id },
      upsert
    )
    groupIds.set(saved.type, saved._id)
  }

  for (const { groupType, ...collection } of seed.collections ?? []) {
    await Collection.findOneAndUpdate(
      { languagePair: pair._id, slug: collection.slug },
      {
        ...collection,
        owner: owner._id,
        languagePair: pair._id,
        group: groupType ? (groupIds.get(groupType) ?? null) : null,
        isOfficial: collection.isOfficial ?? true,
        isPublic: collection.isPublic ?? true,
      },
      upsert
    )
  }

  return { pair, groups: groupIds.size, collections: seed.collections?.length ?? 0 }
}

async function upsertSentences(pair: LanguagePairDocument, seed: SeedCollectionPair, owner: UserDocument) {
  let totalSentences = 0

  for (const [slug, sentences] of Object.entries(seed.sentencesByCollectionSlug ?? {})) {
    const collection = await Collection.findOne({ languagePair: pair._id, slug })
    if (!collection) throw new Error(`Collection not found: ${slug}`)

    for (const [index, sentence] of sentences.entries()) {
      await CollectionSentence.findOneAndUpdate(
        { collection: collection._id, text: sentence.text },
        { ...sentence, collection: collection._id, owner: owner._id, order: sentence.order ?? index },
        upsert
      )
    }

    collection.sentenceCount = await CollectionSentence.countDocuments({ collection: collection._id })
    await collection.save()
    totalSentences += collection.sentenceCount
  }

  pair.totalSentences = totalSentences
  await pair.save()
  return totalSentences
}

runScript(async () => {
  const seed = JSON.parse(await readFile(seedPath, 'utf8')) as Seed
  const owner = await resolveSeedOwner()
  const languages = await upsertLanguages(seed.languages)
  const languagePairs = await upsertLanguagePairs(seed.languagePairs)
  const collectionPairs = seed.collectionPairs ?? (seed.collections ? [seed.collections] : [])
  const totals = { groups: 0, collections: 0, sentences: 0 }

  for (const collectionPair of collectionPairs) {
    const { pair, groups, collections } = await upsertCollections(collectionPair, owner)
    totals.groups += groups
    totals.collections += collections
    totals.sentences += await upsertSentences(pair, collectionPair, owner)
  }

  console.log(`Seeded ${seedPath}`)
  console.log(`Owner: ${owner.email}`)
  console.log(`Languages: ${languages}`)
  console.log(`Language pairs: ${languagePairs}`)
  console.log(`Groups: ${totals.groups}`)
  console.log(`Collections: ${totals.collections}`)
  console.log(`Sentences: ${totals.sentences}`)
})
