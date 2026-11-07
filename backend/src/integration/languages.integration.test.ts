import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import { createTestApp, signUpAs } from '../test-utils/app.ts'
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from '../test-utils/test-database.ts'

describe('languages integration', () => {
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

  async function seedLanguagePair() {
    const german = await Language.create({
      code: 'de',
      iso3: 'deu',
      name: 'German',
      nativeName: 'Deutsch',
      flagIso: 'de',
      ttsLocale: 'de-DE',
    })
    const english = await Language.create({
      code: 'en',
      iso3: 'eng',
      name: 'English',
      nativeName: 'English',
      flagIso: 'gb',
      ttsLocale: 'en-US',
    })
    const pair = await LanguagePair.create({
      slug: 'deu-eng',
      targetLanguage: german._id,
      baseLanguage: english._id,
      name: 'German from English',
      active: true,
    })
    await LanguagePair.create({
      slug: 'eng-deu',
      targetLanguage: english._id,
      baseLanguage: german._id,
      name: 'English from German',
      active: false,
    })
    return { pair }
  }

  it('lists languages and active language pairs with their languages', async () => {
    await seedLanguagePair()
    const languages = await request(app).get('/api/languages')
    const pairs = await request(app).get('/api/language-pairs')

    expect(languages.status).toBe(200)
    expect(languages.body.data).toMatchObject([
      { code: 'en', name: 'English' },
      { code: 'de', name: 'German' },
    ])
    expect(languages.body.data[0]).toHaveProperty('id')
    expect(pairs.status).toBe(200)
    expect(pairs.body.data).toHaveLength(1)
    expect(pairs.body.data[0]).toMatchObject({
      slug: 'deu-eng',
      name: 'German from English',
      active: true,
      targetLanguage: { code: 'de' },
      baseLanguage: { code: 'en' },
    })
  })

  it('selects a language pair once, even when selected repeatedly', async () => {
    const { pair } = await seedLanguagePair()
    const { agent } = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })

    await agent.patch('/api/users/me').send({ selectedLanguagePairSlug: 'deu-eng' })
    const response = await agent.patch('/api/users/me').send({ selectedLanguagePairSlug: 'deu-eng' })

    expect(response.status).toBe(200)
    expect(response.body.data.selectedLanguagePair).toEqual({
      id: String(pair._id),
      slug: 'deu-eng',
      name: 'German from English',
    })
    expect(response.body.data.languagePairs).toEqual([
      { id: String(pair._id), slug: 'deu-eng', name: 'German from English' },
    ])
  })

  it('rejects unknown or inactive language pairs', async () => {
    await seedLanguagePair()
    const { agent } = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })

    for (const slug of ['missing', 'eng-deu']) {
      const response = await agent.patch('/api/users/me').send({ selectedLanguagePairSlug: slug })
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('LANGUAGE_PAIR_NOT_FOUND')
    }
  })
})
