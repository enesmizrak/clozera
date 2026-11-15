import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import { Collection } from '../models/collection.ts'
import { CollectionSentence } from '../models/collection-sentence.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import { createTestApp, signUpAs } from '../test-utils/app.ts'
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from '../test-utils/test-database.ts'

describe('admin integration', () => {
  let app: Express

  beforeAll(async () => {
    await connectTestDatabase()
    app = createTestApp()
  })

  beforeEach(async () => {
    await clearTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  it('rejects admin imports for regular users', async () => {
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const response = await agent.post('/api/admin/language-pairs/import').send({
      languagePairs: [],
    })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('lets admins import languages', async () => {
    const { agent } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    const response = await agent.post('/api/admin/languages/import').send({
      languages: [
        {
          code: 'de',
          iso3: 'deu',
          name: 'German',
          nativeName: 'Deutsch',
          flagIso: 'de',
          ttsLocale: 'de-DE',
        },
      ],
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toHaveLength(1)
    expect(await Language.countDocuments()).toBe(1)
  })

  it('lets admins import language pairs', async () => {
    const { agent } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    await agent.post('/api/admin/languages/import').send({
      languages: [
        {
          code: 'de',
          iso3: 'deu',
          name: 'German',
          nativeName: 'Deutsch',
          flagIso: 'de',
          ttsLocale: 'de-DE',
        },
        {
          code: 'en',
          iso3: 'eng',
          name: 'English',
          nativeName: 'English',
          flagIso: 'gb',
          ttsLocale: 'en-US',
        },
      ],
    })

    const response = await agent.post('/api/admin/language-pairs/import').send({
      languagePairs: [
        {
          slug: 'deu-eng',
          targetLanguageIso3: 'deu',
          baseLanguageIso3: 'eng',
          name: 'German from English',
        },
      ],
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0]).toMatchObject({
      slug: 'deu-eng',
      name: 'German from English',
      active: true,
    })
    expect(await LanguagePair.countDocuments()).toBe(1)
  })

  it('imports starter content through the admin import pipeline', async () => {
    const { agent, user } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    await agent.post('/api/admin/languages/import').send({
      languages: [
        {
          code: 'de',
          iso3: 'deu',
          name: 'German',
          nativeName: 'Deutsch',
          flagIso: 'de',
          ttsLocale: 'de-DE',
        },
        {
          code: 'en',
          iso3: 'eng',
          name: 'English',
          nativeName: 'English',
          flagIso: 'gb',
          ttsLocale: 'en-US',
        },
      ],
    })
    await agent.post('/api/admin/language-pairs/import').send({
      languagePairs: [
        {
          slug: 'deu-eng',
          targetLanguageIso3: 'deu',
          baseLanguageIso3: 'eng',
          name: 'German from English',
        },
      ],
    })
    const collectionsResponse = await agent.post('/api/admin/collections/import').send({
      languagePairSlug: 'deu-eng',
      groups: [
        {
          name: 'Fluency Fast Track',
          type: 'fast_track',
          description: 'Starter sentences for the first MVP loop.',
          order: 1,
        },
      ],
      collections: [
        {
          groupType: 'fast_track',
          name: 'Fast Track Level 1',
          slug: 'fast-track-level-1',
          description: 'A tiny starter set for validating play and review.',
          type: 'fast_track',
          level: 'A1',
          order: 1,
        },
      ],
    })
    const collectionId = collectionsResponse.body.data.collections[0]._id
    const sentencesResponse = await agent
      .post(`/api/admin/collections/${collectionId}/sentences/import`)
      .send({
        sentences: [
          {
            text: 'Wer {{weiss}}?',
            translation: 'Who knows?',
            cloze: 'wrong',
            alternativeAnswers: ['weiss'],
            multipleChoiceOptions: ['spricht', 'weiss', 'spielt', 'kocht'],
          },
          {
            text: 'Ich {{bin}} hier.',
            translation: 'I am here.',
            cloze: 'bin',
            alternativeAnswers: [],
            multipleChoiceOptions: ['bist', 'bin', 'ist', 'sind'],
          },
          {
            text: 'Das ist {{gut}}.',
            translation: 'That is good.',
            cloze: 'gut',
            alternativeAnswers: [],
            multipleChoiceOptions: ['gut', 'gross', 'klein', 'rot'],
          },
        ],
      })

    expect(collectionsResponse.status).toBe(201)
    expect(sentencesResponse.status).toBe(201)
    expect(sentencesResponse.body.data).toHaveLength(3)
    expect(await LanguagePair.countDocuments()).toBe(1)
    expect(await Collection.countDocuments()).toBe(1)
    expect(await CollectionSentence.countDocuments()).toBe(3)
    expect(String((await Collection.findById(collectionId).orFail()).owner)).toBe(String(user._id))
    const importedSentence = await CollectionSentence.findOne({
      collection: collectionId,
      text: 'Wer {{weiss}}?',
    }).orFail()
    expect(String(importedSentence.owner)).toBe(String(user._id))
    expect(importedSentence.cloze).toBe('weiss')
  })

  it('rejects language pair imports when a referenced language is missing', async () => {
    const { agent } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })

    const response = await agent.post('/api/admin/language-pairs/import').send({
      languagePairs: [
        {
          slug: 'deu-eng',
          targetLanguageIso3: 'deu',
          baseLanguageIso3: 'eng',
          name: 'German from English',
        },
      ],
    })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('LANGUAGE_NOT_FOUND')
    expect(await LanguagePair.countDocuments()).toBe(0)
  })

  it('rejects sentence imports for missing collections without creating orphan sentences', async () => {
    const { agent } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })
    const missingCollectionId = new Collection()._id

    const response = await agent
      .post(`/api/admin/collections/${missingCollectionId.toString()}/sentences/import`)
      .send({
        sentences: [
          {
            text: 'Ich {{bin}} hier.',
            translation: 'I am here.',
            cloze: 'bin',
          },
        ],
      })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(await CollectionSentence.countDocuments()).toBe(0)
  })

  it('appends imported sentences after existing ones', async () => {
    const { agent, user } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })
    const language = await Language.create({
      name: 'German',
      nativeName: 'Deutsch',
      code: 'de',
      iso3: 'deu',
      flagIso: 'de',
    })
    const baseLanguage = await Language.create({
      name: 'English',
      nativeName: 'English',
      code: 'en',
      iso3: 'eng',
      flagIso: 'gb',
    })
    const pair = await LanguagePair.create({
      targetLanguage: language._id,
      baseLanguage: baseLanguage._id,
      name: 'German from English',
      slug: 'deu-eng',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'Fast Track Level 1',
      slug: 'fast-track-level-1',
    })
    await CollectionSentence.create({
      owner: user._id,
      collection: collection._id,
      text: 'Ich {{bin}} alt.',
      translation: 'I am old.',
      cloze: 'bin',
      order: 5,
    })

    const response = await agent
      .post(`/api/admin/collections/${collection._id.toString()}/sentences/import`)
      .send({
        sentences: [
          { text: 'Ich {{bin}} hier.', translation: 'I am here.', cloze: 'bin' },
          { text: 'Das ist {{gut}}.', translation: 'That is good.', cloze: 'gut' },
        ],
      })

    expect(response.status).toBeLessThan(300)
    const imported = await CollectionSentence.find({ collection: collection._id }).sort({ order: 1 })
    expect(imported.map(sentence => sentence.order)).toEqual([5, 6, 7])
    const updated = await Collection.findById(collection._id).orFail()
    expect(updated.sentenceCount).toBe(3)
  })

  it('rejects sentence imports with invalid cloze markers', async () => {
    const { agent, user } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })
    const language = await Language.create({
      name: 'German',
      nativeName: 'Deutsch',
      code: 'de',
      iso3: 'deu',
      flagIso: 'de',
    })
    const baseLanguage = await Language.create({
      name: 'English',
      nativeName: 'English',
      code: 'en',
      iso3: 'eng',
      flagIso: 'gb',
    })
    const pair = await LanguagePair.create({
      targetLanguage: language._id,
      baseLanguage: baseLanguage._id,
      name: 'German from English',
      slug: 'deu-eng',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'Fast Track Level 1',
      slug: 'fast-track-level-1',
    })

    const response = await agent
      .post(`/api/admin/collections/${collection._id.toString()}/sentences/import`)
      .send({
        sentences: [
          {
            text: 'Ich {{bin}} {{hier}}.',
            translation: 'I am here.',
          },
        ],
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(await CollectionSentence.countDocuments()).toBe(0)
  })
})
