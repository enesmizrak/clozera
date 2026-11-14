import { pbkdf2Sync, randomBytes } from 'node:crypto'
import type { Express } from 'express'
import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test'
import { createAuth, mongoAuthDatabase } from '../auth/auth.ts'
import { setCredentialPassword } from '../auth/credentials.ts'
import { nativeDatabase } from '../db/connection.ts'
import { migrateLegacyCredentials } from '../auth/legacy-migration.ts'
import { testOutbox } from '../email/transport.ts'
import { Language } from '../models/language.ts'
import { LanguagePair } from '../models/language-pair.ts'
import { User } from '../models/user.ts'
import { ORIGIN, apiLinkIn, clearOutbox, createTestApp, signUpAs, waitForEmail } from '../test-utils/app.ts'
import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from '../test-utils/test-database.ts'

const newLearner = {
  name: 'Ada Lovelace',
  username: 'Ada',
  email: 'Ada@Example.com',
  password: 'secret123',
  timezone: 'Europe/Berlin',
  callbackURL: '/email-verified',
}

describe('accounts integration', () => {
  let app: Express

  beforeAll(async () => {
    await connectTestDatabase()
    app = createTestApp()
  })

  beforeEach(async () => {
    await clearTestDatabase()
    clearOutbox()
  })

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  const signIn = (agent: ReturnType<typeof request>, email: string, password: string) =>
    agent
      .post('/api/auth/sign-in/email')
      .set(ORIGIN)
      .send({ email, password, callbackURL: '/email-verified' })

  describe('sign-up and email verification', () => {
    it('emails a verification link and signs the learner in once it is opened', async () => {
      const signUp = await request(app).post('/api/auth/sign-up/email').set(ORIGIN).send(newLearner)
      expect(signUp.status).toBe(200)
      // No session until the address is confirmed.
      const cookies = (signUp.headers['set-cookie'] as unknown as string[] | undefined) ?? []
      expect(cookies.some(cookie => cookie.includes('session_token=') && !cookie.includes('Max-Age=0'))).toBe(
        false
      )

      const email = await waitForEmail('ada@example.com')
      expect(email.subject).toBe('Confirm your email for Clozera')
      expect(email.text).toContain('Hi Ada Lovelace,')

      const agent = request.agent(app)
      const verify = await agent.get(apiLinkIn(email))
      expect(verify.status).toBe(302)
      expect(verify.headers.location).toBe('/email-verified')

      const session = await agent.get('/api/session')
      expect(session.body.data).toMatchObject({
        name: 'Ada Lovelace',
        username: 'ada',
        email: 'ada@example.com',
        role: 'user',
        timezone: 'Europe/Berlin',
      })
      expect((await User.findOne({ email: 'ada@example.com' }).orFail()).emailVerified).toBe(true)
    })

    it('refuses unverified sign-in and sends a fresh link', async () => {
      await request(app).post('/api/auth/sign-up/email').set(ORIGIN).send(newLearner)
      await waitForEmail('ada@example.com')

      const response = await signIn(request(app), 'ada@example.com', 'secret123')
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('EMAIL_NOT_VERIFIED')
      expect((await waitForEmail('ada@example.com')).subject).toBe('Confirm your email for Clozera')
    })

    it('rejects an invalid verification token', async () => {
      const response = await request(app).get(
        '/api/auth/verify-email?token=invalid&callbackURL=%2Femail-verified'
      )
      expect(response.status).toBe(302)
      expect(response.headers.location).toContain('error=')
    })

    it('rejects sign-up without a username', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .set(ORIGIN)
        .send({ name: 'No Name', email: 'nousername@example.com', password: 'secret123' })

      expect(response.status).toBe(400)
      expect(await User.countDocuments()).toBe(0)
      expect(testOutbox).toHaveLength(0)
    })

    it('does not let sign-up assign the admin role', async () => {
      const response = await request(app)
        .post('/api/auth/sign-up/email')
        .set(ORIGIN)
        .send({ ...newLearner, email: 'mallory@example.com', username: 'mallory', role: 'admin' })

      // Better Auth drops fields declared with `input: false`; the account is created as a regular user.
      expect(response.status).toBe(200)
      expect(await User.countDocuments({ role: 'admin' })).toBe(0)
    })
  })

  describe('sessions and profile', () => {
    it('signs in and out with email and password', async () => {
      await signUpAs(app, { username: 'grace', email: 'grace@example.com' })
      const agent = request.agent(app)

      expect((await signIn(agent, 'Grace@Example.com', 'secret123')).status).toBe(200)
      expect((await agent.get('/api/session')).body.data.email).toBe('grace@example.com')

      expect((await agent.post('/api/auth/sign-out').set(ORIGIN).send({})).status).toBe(200)
      expect((await agent.get('/api/session')).body.data).toBeNull()
    })

    it('rejects invalid credentials', async () => {
      const response = await signIn(request(app), 'missing@example.com', 'wrong-password')
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
  })

  describe('password reset', () => {
    async function resetPassword(email: string, newPassword: string) {
      const requested = await request(app)
        .post('/api/auth/request-password-reset')
        .set(ORIGIN)
        .send({ email, redirectTo: '/reset-password' })
      expect(requested.status).toBe(200)

      const message = await waitForEmail(email)
      expect(message.subject).toBe('Reset your Clozera password')

      const callback = await request(app).get(apiLinkIn(message))
      expect(callback.status).toBe(302)
      const token = new URL(callback.headers.location ?? '', 'http://localhost').searchParams.get('token')
      expect(callback.headers.location).toMatch(/\/reset-password\?token=/)

      return request(app).post('/api/auth/reset-password').set(ORIGIN).send({ newPassword, token })
    }

    it('sets a new password from the emailed link and ends other sessions', async () => {
      const { agent } = await signUpAs(app, { username: 'grace', email: 'grace@example.com' })

      expect((await resetPassword('grace@example.com', 'brand-new-secret')).status).toBe(200)

      expect((await agent.get('/api/session')).body.data).toBeNull()
      expect((await signIn(request(app), 'grace@example.com', 'secret123')).status).toBe(401)
      expect((await signIn(request(app), 'grace@example.com', 'brand-new-secret')).status).toBe(200)
    })

    it('answers the same way for unknown addresses without sending email', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .set(ORIGIN)
        .send({ email: 'nobody@example.com', redirectTo: '/reset-password' })

      expect(response.status).toBe(200)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(testOutbox).toHaveLength(0)
    })

    it('rejects reused or invalid reset tokens', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .set(ORIGIN)
        .send({ newPassword: 'brand-new-secret', token: 'invalid' })
      expect(response.status).toBe(400)
    })
  })

  describe('email change', () => {
    it('needs approval from the current address and confirmation from the new one', async () => {
      const { agent, user } = await signUpAs(app, { username: 'grace', email: 'grace@example.com' })

      const requested = await agent
        .post('/api/auth/change-email')
        .set(ORIGIN)
        .send({ newEmail: 'grace@new.example', callbackURL: '/email-changed' })
      expect(requested.status).toBe(200)

      const approval = await waitForEmail('grace@example.com')
      expect(approval.subject).toBe('Approve the email change on your Clozera account')
      expect(approval.text).toContain('grace@new.example')
      expect((await request(app).get(apiLinkIn(approval))).status).toBe(302)
      expect((await User.findById(user._id).orFail()).email).toBe('grace@example.com')

      const confirmation = await waitForEmail('grace@new.example')
      expect(confirmation.subject).toBe('Confirm your new email address')
      expect((await request(app).get(apiLinkIn(confirmation))).status).toBe(302)

      const updated = await User.findById(user._id).orFail()
      expect(updated.email).toBe('grace@new.example')
      expect(updated.emailVerified).toBe(true)
    })
  })

  describe('legacy accounts', () => {
    it('drops passport-local-mongoose passwords and lets the learner set a new one by email', async () => {
      const salt = randomBytes(32).toString('hex')
      const hash = pbkdf2Sync('legacy-secret', salt, 25_000, 512, 'sha256').toString('hex')
      const { insertedId } = await mongoose.connection.collection('users').insertOne({
        name: 'Legacy Learner',
        username: 'Legacy',
        email: 'Legacy@Example.com',
        role: 'user',
        timezone: 'UTC',
        hash,
        salt,
        pinnedCollections: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      expect(await migrateLegacyCredentials({ apply: false })).toMatchObject({ pending: 1, migrated: 0 })
      expect(await migrateLegacyCredentials({ apply: true })).toMatchObject({
        pending: 1,
        migrated: 1,
        migratedEmails: ['legacy@example.com'],
      })
      expect(await migrateLegacyCredentials({ apply: true })).toMatchObject({ pending: 0, migrated: 0 })

      const migrated = await User.findById(insertedId).select('+hash +salt').orFail()
      expect(migrated).toMatchObject({ email: 'legacy@example.com', username: 'legacy', emailVerified: true })
      expect(migrated.hash).toBeUndefined()
      expect(migrated.salt).toBeUndefined()

      // The old password no longer works; the reset flow creates the Better Auth credential.
      expect((await signIn(request(app), 'legacy@example.com', 'legacy-secret')).status).toBe(401)
      await request(app)
        .post('/api/auth/request-password-reset')
        .set(ORIGIN)
        .send({ email: 'legacy@example.com', redirectTo: '/reset-password' })
      const callback = await request(app).get(apiLinkIn(await waitForEmail('legacy@example.com')))
      const token = new URL(callback.headers.location ?? '', 'http://localhost').searchParams.get('token')
      expect(
        (
          await request(app)
            .post('/api/auth/reset-password')
            .set(ORIGIN)
            .send({ newPassword: 'fresh-secret', token })
        ).status
      ).toBe(200)

      const agent = request.agent(app)
      expect((await signIn(agent, 'legacy@example.com', 'fresh-secret')).status).toBe(200)
      expect((await agent.get('/api/session')).body.data.id).toBe(String(insertedId))
    })

    it('skips legacy users whose email collides with another account', async () => {
      await signUpAs(app, { username: 'taken', email: 'taken@example.com' })
      await mongoose.connection.collection('users').insertOne({
        name: 'Duplicate',
        username: 'duplicate',
        email: 'Taken@Example.com',
        hash: 'x',
        salt: 'y',
      })

      expect(await migrateLegacyCredentials({ apply: true })).toMatchObject({
        migrated: 0,
        conflicts: ['taken@example.com'],
      })
    })
  })

  describe('operator password changes', () => {
    const makeAuth = () => createAuth(mongoAuthDatabase(nativeDatabase(), mongoose.connection.getClient()))

    it('ends existing sessions when an operator sets a password', async () => {
      const { agent, user, email, password } = await signUpAs(app, {
        username: 'operatortarget',
        email: 'operatortarget@example.com',
      })
      expect((await agent.get('/api/session')).body.data).not.toBeNull()

      await setCredentialPassword(makeAuth(), String(user._id), 'new-password-123')

      expect((await agent.get('/api/session')).body).toEqual({ data: null })
      const fresh = await request(app)
        .post('/api/auth/sign-in/email')
        .set(ORIGIN)
        .send({ email, password: 'new-password-123' })
      expect(fresh.status).toBe(200)
      const old = await request(app).post('/api/auth/sign-in/email').set(ORIGIN).send({ email, password })
      expect(old.status).not.toBe(200)
    })

    it('rejects passwords shorter than the policy', async () => {
      const { user } = await signUpAs(app, { username: 'shortpw', email: 'shortpw@example.com' })
      await expect(setCredentialPassword(makeAuth(), String(user._id), 'short')).rejects.toThrow(/at least 8/)
    })
  })
})
