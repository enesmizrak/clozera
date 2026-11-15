#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeSentencePayload } from '@clozera/shared'
import { Effect } from 'effect'
import { z } from 'zod'
import { Collection } from '../src/models/collection.ts'
import { CollectionSentence } from '../src/models/collection-sentence.ts'
import {
  collectionsImportSchema,
  importCollections,
  importLanguagePairs,
  importLanguages,
  languagePairsImportSchema,
  languagesImportSchema,
  sentencesImportSchema,
} from '../src/services/admin-service.ts'
import { LanguagePair, type LanguagePairDocument } from '../src/models/language-pair.ts'
import { User, type UserDocument } from '../src/models/user.ts'
import { requireEnv, runScript } from './lib/run-script.ts'

const seedSchema = z.object({
  languages: languagesImportSchema.shape.languages,
  languagePairs: languagePairsImportSchema.shape.languagePairs,
  collectionPairs: z
    .array(
      collectionsImportSchema.extend({
        sentencesByCollectionSlug: z.record(z.string(), sentencesImportSchema.shape.sentences).default({}),
      })
    )
    .default([]),
})
type SeedCollectionPair = z.output<typeof seedSchema>['collectionPairs'][number]

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

async function upsertSentences(pair: LanguagePairDocument, seed: SeedCollectionPair, owner: UserDocument) {
  let totalSentences = 0

  for (const [slug, sentences] of Object.entries(seed.sentencesByCollectionSlug)) {
    const collection = await Collection.findOne({ languagePair: pair._id, slug })
    if (!collection) throw new Error(`Collection not found: ${slug}`)

    for (const [index, sentence] of sentences.entries()) {
      const normalized = normalizeSentencePayload(sentence)
      if (!normalized.cloze) throw new Error(`Sentence ${index} in ${slug} has no {{cloze}} marker.`)
      await CollectionSentence.findOneAndUpdate(
        { collection: collection._id, text: sentence.text },
        { ...normalized, collection: collection._id, owner: owner._id, order: sentence.order ?? index },
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

const run = <A>(program: Effect.Effect<A, { message: string }>) =>
  Effect.runPromise(program).catch((error: { message: string }) => {
    throw new Error(error.message)
  })

runScript(async () => {
  const parsed = seedSchema.safeParse(JSON.parse(await readFile(seedPath, 'utf8')))
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error))
  const seed = parsed.data
  const owner = await resolveSeedOwner()
  const languages = await run(importLanguages({ languages: seed.languages }))
  const languagePairs = await run(importLanguagePairs({ languagePairs: seed.languagePairs }))
  const totals = { groups: 0, collections: 0, sentences: 0 }

  for (const collectionPair of seed.collectionPairs) {
    const { groups, collections } = await run(importCollections(collectionPair, owner))
    const pair = await LanguagePair.findOne({ slug: collectionPair.languagePairSlug }).orFail()
    totals.groups += groups.length
    totals.collections += collections.length
    totals.sentences += await upsertSentences(pair, collectionPair, owner)
  }

  console.log(`Seeded ${seedPath}`)
  console.log(`Owner: ${owner.email}`)
  console.log(`Languages: ${languages.length}`)
  console.log(`Language pairs: ${languagePairs.length}`)
  console.log(`Groups: ${totals.groups}`)
  console.log(`Collections: ${totals.collections}`)
  console.log(`Sentences: ${totals.sentences}`)
})
