import { pbkdf2Sync, randomBytes } from 'node:crypto'
import type { Express } from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import { migrateLegacyCredentials } from '../auth/legacy-migration.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import { User } from '../models/user.ts'
import { createTestApp, signUpAs } from '../test-utils/app.ts'
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from '../test-utils/test-database.ts'

const origin = { Origin: 'http://localhost:5173' }

describe('accounts integration', () => {
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

  it('signs up with a username and timezone and starts a session', async () => {
    const { agent } = await signUpAs(app, {
      name: 'Ada Lovelace',
      username: 'Ada',
      email: 'Ada@Example.com',
      timezone: 'Europe/Berlin',
    })

    const session = await agent.get('/api/session')
    expect(session.status).toBe(200)
    expect(session.body.data).toMatchObject({
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      role: 'user',
      timezone: 'Europe/Berlin',
      selectedLanguagePair: null,
      languagePairs: [],
    })

    const stored = await User.findOne({ email: 'ada@example.com' }).orFail()
    expect(String(stored._id)).toBe(session.body.data.id)
  })

  it('rejects sign-up without a username', async () => {
    const response = await request(app)
      .post('/api/auth/sign-up/email')
      .set(origin)
      .send({ name: 'No Name', email: 'nousername@example.com', password: 'secret123' })

    expect(response.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })

  it('does not let sign-up assign the admin role', async () => {
    const response = await request(app).post('/api/auth/sign-up/email').set(origin).send({
      name: 'Mallory',
      username: 'mallory',
      email: 'mallory@example.com',
      password: 'secret123',
      role: 'admin',
    })

    // Better Auth drops fields declared with `input: false`; the account is created as a regular user.
    expect(response.status).toBe(200)
    expect(await User.countDocuments({ role: 'admin' })).toBe(0)
    expect((await User.findOne({ email: 'mallory@example.com' }).orFail()).role).toBe('user')
  })

  it('signs in and out with email and password', async () => {
    await signUpAs(app, { username: 'grace', email: 'grace@example.com' })
    const agent = request.agent(app)

    const signIn = await agent
      .post('/api/auth/sign-in/email')
      .set(origin)
      .send({ email: 'grace@example.com', password: 'secret123' })
    expect(signIn.status).toBe(200)
    expect((await agent.get('/api/session')).body.data.email).toBe('grace@example.com')

    const signOut = await agent.post('/api/auth/sign-out').set(origin).send({})
    expect(signOut.status).toBe(200)
    expect((await agent.get('/api/session')).body.data).toBeNull()
  })

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/sign-in/email')
      .set(origin)
      .send({ email: 'missing@example.com', password: 'wrong-password' })

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('INVALID_EMAIL_OR_PASSWORD')
  })

  it('returns the populated selected language pair in the profile', async () => {
    const german = await Language.create({
      code: 'de',
      iso3: 'deu',
      name: 'German',
      nativeName: 'Deutsch',
      flagIso: 'de',
    })
    const english = await Language.create({
      code: 'en',
      iso3: 'eng',
      name: 'English',
      nativeName: 'English',
      flagIso: 'gb',
    })
    const pair = await LanguagePair.create({
      slug: 'deu-eng',
      targetLanguage: german._id,
      baseLanguage: english._id,
      name: 'German from English',
    })
    const { agent, user } = await signUpAs(app, { username: 'grace', email: 'grace@example.com' })
    await User.updateOne({ _id: user._id }, { selectedLanguagePair: pair._id, languagePairs: [pair._id] })

    const response = await agent.get('/api/users/me')
    expect(response.status).toBe(200)
    expect(response.body.data.selectedLanguagePair).toEqual({
      id: String(pair._id),
      slug: 'deu-eng',
      name: 'German from English',
    })
    expect(response.body.data.languagePairs).toHaveLength(1)
  })

  it('updates the profile and rejects a username that is already taken', async () => {
    await signUpAs(app, { username: 'taken', email: 'taken@example.com' })
    const { agent } = await signUpAs(app, {
      name: 'Grace Hopper',
      username: 'grace',
      email: 'grace@example.com',
    })

    const update = await agent
      .patch('/api/users/me')
      .send({ name: 'Amazing Grace', timezone: 'Europe/Berlin' })
    expect(update.status).toBe(200)
    expect(update.body.data).toMatchObject({
      name: 'Amazing Grace',
      username: 'grace',
      timezone: 'Europe/Berlin',
    })

    const conflict = await agent.patch('/api/users/me').send({ username: 'taken' })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('CONFLICT')

    const invalid = await agent.patch('/api/users/me').send({ name: '' })
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.details[0].field).toBe('name')
  })

  it('rejects profile requests without a session', async () => {
    const response = await request(app).get('/api/users/me')
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('migrates passport-local-mongoose credentials so existing passwords keep working', async () => {
    const salt = randomBytes(32).toString('hex')
    const hash = pbkdf2Sync('legacy-secret', salt, 25_000, 512, 'sha256').toString('hex')
    const { insertedId } = await mongoose.connection.collection('users').insertOne({
      name: 'Legacy Learner',
      username: 'legacy',
      email: 'Legacy@Example.com',
      role: 'user',
      timezone: 'UTC',
      hash,
      salt,
      pinnedCollections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const dryRun = await migrateLegacyCredentials({ apply: false })
    expect(dryRun).toMatchObject({ pending: 1, migrated: 0 })

    const result = await migrateLegacyCredentials({ apply: true })
    expect(result).toMatchObject({ pending: 1, migrated: 1 })
    expect(await migrateLegacyCredentials({ apply: true })).toMatchObject({ pending: 0, migrated: 0 })

    const migrated = await User.findById(insertedId).select('+hash +salt').orFail()
    expect(migrated.email).toBe('legacy@example.com')
    expect(migrated.hash).toBeUndefined()

    const agent = request.agent(app)
    const signIn = await agent
      .post('/api/auth/sign-in/email')
      .set(origin)
      .send({ email: 'legacy@example.com', password: 'legacy-secret' })
    expect(signIn.status).toBe(200)
    expect((await agent.get('/api/session')).body.data.id).toBe(String(insertedId))
  })
})
