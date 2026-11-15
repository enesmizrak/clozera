import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import { Collection } from '../models/collection.ts'
import { CollectionGroup } from '../models/collection-group.ts'
import { CollectionSentence } from '../models/collection-sentence.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import { User } from '../models/user.ts'
import { createTestApp, signUpAs } from '../test-utils/app.ts'
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from '../test-utils/test-database.ts'

describe('collections integration', () => {
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

  async function seedCollection() {
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
    const group = await CollectionGroup.create({
      languagePair: pair._id,
      name: 'Fast Track',
      type: 'fast_track',
      order: 1,
    })
    const collection = await Collection.create({
      languagePair: pair._id,
      group: group._id,
      name: 'Fast Track Level 1',
      slug: 'fast-track-level-1',
      type: 'fast_track',
      level: 'A1',
      sentenceCount: 2,
      order: 1,
    })

    await CollectionSentence.create([
      {
        collection: collection._id,
        text: 'Ich {{bin}} hier.',
        translation: 'I am here.',
        cloze: 'bin',
        multipleChoiceOptions: ['bin', 'bist', 'ist'],
        order: 1,
      },
      {
        collection: collection._id,
        text: 'Das ist {{gut}}.',
        translation: 'That is good.',
        cloze: 'gut',
        multipleChoiceOptions: ['gut', 'rot', 'klein'],
        order: 2,
      },
    ])

    return { collection, group, pair }
  }

  async function twoLearnersWithCollection(isPublic: boolean) {
    const { pair } = await seedCollection()
    const owner = await signUpAs(app, { username: 'owner', email: 'owner@example.com' })
    const other = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })
    const collection = await Collection.create({
      owner: owner.user._id,
      languagePair: pair._id,
      name: 'Owner Practice',
      slug: 'owner-practice',
      isOfficial: false,
      isPublic,
    })
    const sentence = await CollectionSentence.create({
      collection: collection._id,
      owner: owner.user._id,
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
      cloze: 'reise',
    })
    await Collection.updateOne({ _id: collection._id }, { sentenceCount: 1 })
    return { pair, owner, other, collection, sentence }
  }

  it('lists collections for a language pair', async () => {
    await seedCollection()
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const response = await agent.get('/api/collections').query({ languagePair: 'deu-eng' })

    expect(response.status).toBe(200)
    expect(response.body.meta).toEqual({
      total: 1,
      page: 1,
      perPage: 20,
    })
    expect(response.body.data.collections).toHaveLength(1)
    expect(response.body.data.collections[0]).toMatchObject({
      id: expect.any(String),
      name: 'Fast Track Level 1',
      slug: 'fast-track-level-1',
      sentenceCount: 2,
      relationship: 'official',
      visibility: 'public',
      isPinned: false,
      capabilities: {
        canEdit: false,
        canDelete: false,
        canChangeVisibility: false,
        canPin: true,
        canUnpin: false,
      },
      languagePair: {
        slug: 'deu-eng',
        name: 'German from English',
      },
      group: {
        id: expect.any(String),
        name: 'Fast Track',
        type: 'fast_track',
        description: '',
        order: 1,
      },
    })
  })

  it('lists only owned collections when owner is me', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'My Practice',
      slug: 'my-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await agent.get('/api/collections').query({ owner: 'me' })

    expect(response.status).toBe(200)
    expect(response.body.data.collections).toHaveLength(1)
    expect(response.body.data.collections[0]).toMatchObject({
      name: 'My Practice',
      relationship: 'owned',
      visibility: 'private',
    })
  })

  it('lists another learner public collection as community with creator attribution', async () => {
    const { pair } = await seedCollection()
    const { user: owner } = await signUpAs(app, {
      name: 'Grace Hopper',
      username: 'grace',
      email: 'grace@example.com',
    })
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    await Collection.create({
      owner: owner._id,
      languagePair: pair._id,
      name: 'Grace Travel',
      slug: 'grace-travel',
      isOfficial: false,
      isPublic: true,
    })

    const response = await agent.get('/api/collections').query({ languagePair: 'deu-eng' })
    const collection = response.body.data.collections.find(
      (item: { slug: string }) => item.slug === 'grace-travel'
    )

    expect(response.status).toBe(200)
    expect(collection).toMatchObject({
      relationship: 'community',
      visibility: 'public',
      creator: {
        id: String(owner._id),
        displayName: 'Grace Hopper',
      },
      capabilities: {
        canEdit: false,
        canDelete: false,
        canChangeVisibility: false,
        canPin: true,
        canUnpin: false,
      },
    })
  })

  it('lists paginated collection sentences without progress data', async () => {
    const { collection } = await seedCollection()
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const response = await agent.get(`/api/collections/${collection._id.toString()}/sentences`).query({
      page: 1,
      perPage: 1,
    })

    expect(response.status).toBe(200)
    expect(response.body.meta).toEqual({
      total: 2,
      page: 1,
      perPage: 1,
    })
    expect(response.body.data.sentences).toHaveLength(1)
    expect(response.body.data.sentences[0]).toMatchObject({
      text: 'Ich {{bin}} hier.',
      translation: 'I am here.',
      cloze: 'bin',
    })
    expect(response.body.data.sentences[0]).not.toHaveProperty('progress')
  })

  it('does not expose private collections to other authenticated users', async () => {
    const { collection } = await seedCollection()
    await Collection.findByIdAndUpdate(collection._id, {
      isPublic: false,
      owner: null,
    })
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const collectionResponse = await agent.get(`/api/collections/${collection._id.toString()}`)
    const sentencesResponse = await agent.get(`/api/collections/${collection._id.toString()}/sentences`)

    expect(collectionResponse.status).toBe(404)
    expect(collectionResponse.body.error.code).toBe('NOT_FOUND')
    expect(sentencesResponse.status).toBe(404)
    expect(sentencesResponse.body.error.code).toBe('NOT_FOUND')
  })

  it('creates a user collection for a language pair', async () => {
    await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const response = await agent.post('/api/collections').send({
      languagePairSlug: 'deu-eng',
      name: 'Travel Phrases',
      description: 'Things I want to remember',
      isPublic: false,
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      name: 'Travel Phrases',
      slug: 'travel-phrases',
      description: 'Things I want to remember',
      isOfficial: false,
      visibility: 'private',
      relationship: 'owned',
      isPinned: true,
    })

    const collection = await Collection.findById(response.body.data.id).orFail()
    expect(String(collection.owner)).toBe(String(user._id))
    const updatedUser = await User.findById(user._id).orFail()
    expect(updatedUser.pinnedCollections.map(String)).toContain(String(collection._id))
  })

  it('pins and unpins dashboard collections idempotently', async () => {
    const { collection } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })

    const firstPin = await agent.post('/api/dashboard/collections').send({ collectionId: collection._id })
    const secondPin = await agent.post('/api/dashboard/collections').send({ collectionId: collection._id })
    const dashboard = await agent.get('/api/dashboard/collections')
    const firstUnpin = await agent.delete(`/api/dashboard/collections/${collection._id.toString()}`)
    const secondUnpin = await agent.delete(`/api/dashboard/collections/${collection._id.toString()}`)

    expect(firstPin.status).toBe(200)
    expect(secondPin.status).toBe(200)
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.data.collections).toHaveLength(1)
    expect(dashboard.body.data.collections[0]).toMatchObject({
      id: String(collection._id),
      relationship: 'official',
      isPinned: true,
      capabilities: {
        canPin: false,
        canUnpin: true,
      },
    })
    expect(firstUnpin.status).toBe(200)
    expect(firstUnpin.body.data).toMatchObject({
      id: String(collection._id),
      isPinned: false,
      capabilities: {
        canPin: true,
        canUnpin: false,
      },
    })
    expect(secondUnpin.status).toBe(200)
    expect(secondUnpin.body.data).toMatchObject({
      id: String(collection._id),
      isPinned: false,
      capabilities: {
        canPin: true,
        canUnpin: false,
      },
    })
    const updatedUser = await User.findById(user._id).orFail()
    expect(updatedUser.pinnedCollections).toHaveLength(0)
  })

  it('filters inaccessible pinned collections from the dashboard without removing the pin', async () => {
    const { pair } = await seedCollection()
    const { user: owner } = await signUpAs(app, {
      username: 'owner',
      email: 'owner@example.com',
    })
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: owner._id,
      languagePair: pair._id,
      name: 'Owner Practice',
      slug: 'owner-practice',
      isOfficial: false,
      isPublic: true,
    })

    await agent.post('/api/dashboard/collections').send({ collectionId: collection._id })
    await Collection.findByIdAndUpdate(collection._id, { isPublic: false })

    const hiddenDashboard = await agent.get('/api/dashboard/collections')
    const updatedUser = await User.findById(user._id).orFail()

    expect(hiddenDashboard.status).toBe(200)
    expect(hiddenDashboard.body.data.collections).toEqual([])
    expect(updatedUser.pinnedCollections.map(String)).toContain(String(collection._id))

    await Collection.findByIdAndUpdate(collection._id, { isPublic: true })
    const visibleDashboard = await agent.get('/api/dashboard/collections')

    expect(visibleDashboard.body.data.collections).toHaveLength(1)
    expect(visibleDashboard.body.data.collections[0].slug).toBe('owner-practice')
  })

  it('updates owned non-official collection metadata and visibility', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'Draft Practice',
      slug: 'draft-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await agent.patch(`/api/collections/${collection._id.toString()}`).send({
      name: 'Travel Practice',
      description: 'Ready to share',
      visibility: 'public',
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      name: 'Travel Practice',
      description: 'Ready to share',
      relationship: 'owned',
      visibility: 'public',
      capabilities: {
        canEdit: true,
        canDelete: true,
        canChangeVisibility: true,
      },
    })
    await expect(Collection.findById(collection._id)).resolves.toMatchObject({
      name: 'Travel Practice',
      isPublic: true,
    })
  })

  it('deletes owned non-official collections and removes stale pins', async () => {
    const { pair } = await seedCollection()
    const { agent: ownerAgent, user: owner } = await signUpAs(app, {
      username: 'owner',
      email: 'owner@example.com',
    })
    const { agent: viewerAgent, user: viewer } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: owner._id,
      languagePair: pair._id,
      name: 'Shared Practice',
      slug: 'shared-practice',
      isOfficial: false,
      isPublic: true,
    })
    await CollectionSentence.create({
      owner: owner._id,
      collection: collection._id,
      text: 'Ich {{teile}}.',
      translation: 'I share.',
      cloze: 'teile',
    })
    await viewerAgent.post('/api/dashboard/collections').send({ collectionId: collection._id })

    const response = await ownerAgent.delete(`/api/collections/${collection._id.toString()}`)

    expect(response.status).toBe(204)
    await expect(Collection.findById(collection._id)).resolves.toBeNull()
    await expect(CollectionSentence.findOne({ collection: collection._id })).resolves.toBeNull()
    const updatedViewer = await User.findById(viewer._id).orFail()
    expect(updatedViewer.pinnedCollections.map(String)).not.toContain(String(collection._id))
  })

  it('does not allow learner-facing edits to official collections even when the user is admin owner', async () => {
    const { collection } = await seedCollection()
    const { agent, user: admin } = await signUpAs(app, {
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
    })
    await Collection.findByIdAndUpdate(collection._id, { owner: admin._id })

    const updateResponse = await agent.patch(`/api/collections/${collection._id.toString()}`).send({
      name: 'Changed Official',
    })
    const sentenceResponse = await agent
      .post(`/api/collections/${collection._id.toString()}/sentences`)
      .send({
        text: 'Ich {{ändere}}.',
        translation: 'I change.',
      })

    expect(updateResponse.status).toBe(403)
    expect(sentenceResponse.status).toBe(403)
  })

  it('creates a unique slug when another collection already uses the generated slug', async () => {
    await seedCollection()
    const { agent: firstAgent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const { agent: secondAgent } = await signUpAs(app, {
      username: 'grace',
      email: 'grace@example.com',
    })

    const firstResponse = await firstAgent.post('/api/collections').send({
      languagePairSlug: 'deu-eng',
      name: 'Travel Phrases',
    })
    const secondResponse = await secondAgent.post('/api/collections').send({
      languagePairSlug: 'deu-eng',
      name: 'Travel Phrases',
    })

    expect(firstResponse.status).toBe(201)
    expect(secondResponse.status).toBe(201)
    expect(firstResponse.body.data.slug).toBe('travel-phrases')
    expect(secondResponse.body.data.slug).toBe('travel-phrases-2')
  })

  it('creates a collection named in Cyrillic', async () => {
    await seedCollection()
    const { agent } = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })

    const response = await agent.post('/api/collections').send({
      languagePairSlug: 'deu-eng',
      name: 'Глаголы движения',
    })

    expect(response.status).toBe(201)
    expect(response.body.data.slug).toBe('глаголы-движения')
  })

  it('rejects a collection name without letters or numbers', async () => {
    await seedCollection()
    const { agent } = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })

    const response = await agent.post('/api/collections').send({
      languagePairSlug: 'deu-eng',
      name: '!!!',
    })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates a unique slug when another learner uses the same Cyrillic name', async () => {
    await seedCollection()
    const { agent: firstAgent } = await signUpAs(app, { username: 'ada', email: 'ada@example.com' })
    const { agent: secondAgent } = await signUpAs(app, { username: 'grace', email: 'grace@example.com' })

    const firstResponse = await firstAgent
      .post('/api/collections')
      .send({ languagePairSlug: 'deu-eng', name: 'Глаголы движения' })
    const secondResponse = await secondAgent
      .post('/api/collections')
      .send({ languagePairSlug: 'deu-eng', name: 'Глаголы движения' })

    expect(firstResponse.body.data.slug).toBe('глаголы-движения')
    expect(secondResponse.status).toBe(201)
    expect(secondResponse.body.data.slug).toBe('глаголы-движения-2')
  })

  it('adds a sentence to an owned user collection', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'My Practice',
      slug: 'my-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await agent.post(`/api/collections/${collection._id.toString()}/sentences`).send({
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
      alternativeAnswers: ['reise'],
      multipleChoiceOptions: ['reise', 'schlafe', 'koche'],
      hint: 'verb',
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
      cloze: 'reise',
      hint: 'verb',
    })

    const updatedCollection = await Collection.findById(collection._id).orFail()
    expect(updatedCollection.sentenceCount).toBe(1)
  })

  it('ignores posted cloze when adding a sentence', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'My Practice',
      slug: 'my-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await agent.post(`/api/collections/${collection._id.toString()}/sentences`).send({
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
      cloze: 'wrong',
    })

    expect(response.status).toBe(201)
    expect(response.body.data.cloze).toBe('reise')
  })

  it('updates an owned sentence and derives cloze from the edited text', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'My Practice',
      slug: 'my-practice',
      isOfficial: false,
      isPublic: false,
    })
    const sentence = await CollectionSentence.create({
      owner: user._id,
      collection: collection._id,
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
    })

    const response = await agent
      .patch(`/api/collections/${collection._id.toString()}/sentences/${sentence._id.toString()}`)
      .send({
        text: 'Ich {{lerne}} heute.',
        translation: 'I learn today.',
        cloze: 'wrong',
        alternativeAnswers: ['lerne'],
        multipleChoiceOptions: ['lerne', 'reise'],
        hint: 'verb',
        notes: 'present tense',
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      text: 'Ich {{lerne}} heute.',
      translation: 'I learn today.',
      cloze: 'lerne',
      alternativeAnswers: ['lerne'],
      multipleChoiceOptions: ['lerne', 'reise'],
      hint: 'verb',
      notes: 'present tense',
    })
    expect((await CollectionSentence.findById(sentence._id).orFail()).cloze).toBe('lerne')
  })

  it('rejects sentence updates with invalid cloze markers', async () => {
    const { pair } = await seedCollection()
    const { agent, user } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: user._id,
      languagePair: pair._id,
      name: 'My Practice',
      slug: 'my-practice',
      isOfficial: false,
      isPublic: false,
    })
    const sentence = await CollectionSentence.create({
      owner: user._id,
      collection: collection._id,
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
    })

    const response = await agent
      .patch(`/api/collections/${collection._id.toString()}/sentences/${sentence._id.toString()}`)
      .send({
        text: 'Ich {{reise}} {{morgen}}.',
        translation: 'I travel tomorrow.',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('does not allow adding a sentence to another user collection', async () => {
    const { pair } = await seedCollection()
    const { user: owner } = await signUpAs(app, {
      username: 'owner',
      email: 'owner@example.com',
    })
    const { agent } = await signUpAs(app, {
      username: 'ada',
      email: 'ada@example.com',
    })
    const collection = await Collection.create({
      owner: owner._id,
      languagePair: pair._id,
      name: 'Owner Practice',
      slug: 'owner-practice',
      isOfficial: false,
      isPublic: true,
    })

    const response = await agent.post(`/api/collections/${collection._id.toString()}/sentences`).send({
      text: 'Ich {{reise}} morgen.',
      translation: 'I travel tomorrow.',
      cloze: 'reise',
    })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('does not allow another learner to rename or change visibility of a public collection', async () => {
    const { other, collection } = await twoLearnersWithCollection(true)

    const response = await other.agent
      .patch(`/api/collections/${collection._id.toString()}`)
      .send({ name: 'Hijacked', visibility: 'private' })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    const stored = await Collection.findById(collection._id)
    expect(stored?.name).toBe('Owner Practice')
    expect(stored?.isPublic).toBe(true)
  })

  it('does not allow another learner to delete a public collection', async () => {
    const { other, collection } = await twoLearnersWithCollection(true)

    const response = await other.agent.delete(`/api/collections/${collection._id.toString()}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    expect(await Collection.exists({ _id: collection._id })).toBeTruthy()
    expect(await CollectionSentence.countDocuments({ collection: collection._id })).toBe(1)
  })

  it('does not reveal or change another learner private collection on update', async () => {
    const { other, collection } = await twoLearnersWithCollection(false)

    const response = await other.agent
      .patch(`/api/collections/${collection._id.toString()}`)
      .send({ name: 'Hijacked' })

    // Current behavior: writes answer 403 even for private collections; reads answer 404. See plans/004 maintenance notes.
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    const stored = await Collection.findById(collection._id)
    expect(stored?.name).toBe('Owner Practice')
  })

  it("does not allow another learner to edit a sentence in someone else's collection", async () => {
    const { other, collection, sentence } = await twoLearnersWithCollection(true)

    const response = await other.agent
      .patch(`/api/collections/${collection._id.toString()}/sentences/${sentence._id.toString()}`)
      .send({ text: 'Ich {{fahre}} morgen.', translation: 'I drive tomorrow.' })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    const stored = await CollectionSentence.findById(sentence._id)
    expect(stored?.text).toBe('Ich {{reise}} morgen.')
  })

  it("does not allow another learner to delete a sentence in someone else's collection", async () => {
    const { other, collection, sentence } = await twoLearnersWithCollection(true)

    const response = await other.agent.delete(
      `/api/collections/${collection._id.toString()}/sentences/${sentence._id.toString()}`
    )

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
    expect(await CollectionSentence.exists({ _id: sentence._id })).toBeTruthy()
  })

  it('does not edit a sentence through a different owned collection', async () => {
    const { pair, other, sentence } = await twoLearnersWithCollection(true)
    const adaCollection = await Collection.create({
      owner: other.user._id,
      languagePair: pair._id,
      name: 'Ada Practice',
      slug: 'ada-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await other.agent
      .patch(`/api/collections/${adaCollection._id.toString()}/sentences/${sentence._id.toString()}`)
      .send({ text: 'Ich {{fahre}} morgen.', translation: 'I drive tomorrow.' })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
    const stored = await CollectionSentence.findById(sentence._id)
    expect(stored?.text).toBe('Ich {{reise}} morgen.')
  })

  it('does not delete a sentence through a different owned collection', async () => {
    const { pair, other, sentence } = await twoLearnersWithCollection(true)
    const adaCollection = await Collection.create({
      owner: other.user._id,
      languagePair: pair._id,
      name: 'Ada Practice',
      slug: 'ada-practice',
      isOfficial: false,
      isPublic: false,
    })

    const response = await other.agent.delete(
      `/api/collections/${adaCollection._id.toString()}/sentences/${sentence._id.toString()}`
    )

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
    expect(await CollectionSentence.exists({ _id: sentence._id })).toBeTruthy()
  })

  it('deletes an owned sentence and updates the sentence count', async () => {
    const { owner, collection, sentence } = await twoLearnersWithCollection(true)

    const response = await owner.agent.delete(
      `/api/collections/${collection._id.toString()}/sentences/${sentence._id.toString()}`
    )

    expect(response.status).toBe(204)
    expect(await CollectionSentence.exists({ _id: sentence._id })).toBeNull()
    const stored = await Collection.findById(collection._id)
    expect(stored?.sentenceCount).toBe(0)
  })

  it('does not pin another learner private collection', async () => {
    const { other, collection } = await twoLearnersWithCollection(false)

    const response = await other.agent
      .post('/api/dashboard/collections')
      .send({ collectionId: collection._id.toString() })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
    const user = await User.findById(other.user._id)
    expect(user?.pinnedCollections).toHaveLength(0)
  })
})
