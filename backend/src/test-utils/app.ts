import mongoose from 'mongoose'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { createAuth, mongoAuthDatabase } from '../auth/auth.ts'
import { nativeDatabase } from '../db/connection.ts'
import { type OutgoingEmail, testOutbox } from '../email/transport.ts'
import { User } from '../models/user.ts'

export const ORIGIN = { Origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }

export interface TestUserInput {
  name?: string
  username?: string
  email?: string
  password?: string
  role?: 'user' | 'admin'
  timezone?: string
}

/** Builds the real app against the connected integration test database. */
export function createTestApp(): Express {
  return createApp(createAuth(mongoAuthDatabase(nativeDatabase(), mongoose.connection.getClient())))
}

/** Waits for the next email to an address; auth emails are delivered after the response. */
export async function waitForEmail(to: string, timeoutMs = 2000): Promise<OutgoingEmail> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const index = testOutbox.findIndex(email => email.to === to)
    if (index !== -1) return testOutbox.splice(index, 1)[0] as OutgoingEmail
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`No email was sent to ${to}.`)
}

/** The first link in an email that points at the API, as a path the test app can request. */
export function apiLinkIn(email: OutgoingEmail): string {
  const match = email.text.match(/https?:\/\/\S+\/api\/auth\/\S+/)
  if (!match) throw new Error(`No auth link in "${email.subject}".`)
  const url = new URL(match[0])
  return url.pathname + url.search
}

export function clearOutbox(): void {
  testOutbox.length = 0
}

/** Signs up, marks the address verified and signs in, returning a cookie-carrying agent. */
export async function signUpAs(app: Express, input: TestUserInput = {}) {
  const credentials = {
    name: input.name ?? 'Test User',
    username: input.username ?? 'testuser',
    email: input.email ?? 'test@example.com',
    password: input.password ?? 'secret123',
    timezone: input.timezone ?? 'UTC',
  }
  const signUp = await request(app).post('/api/auth/sign-up/email').set(ORIGIN).send(credentials)
  if (signUp.status !== 200)
    throw new Error(`Sign-up failed (${signUp.status}): ${JSON.stringify(signUp.body)}`)

  await User.updateOne(
    { email: credentials.email.toLowerCase() },
    { emailVerified: true, ...(input.role === 'admin' ? { role: 'admin' } : {}) }
  )
  const agent = request.agent(app)
  const signIn = await agent
    .post('/api/auth/sign-in/email')
    .set(ORIGIN)
    .send({ email: credentials.email, password: credentials.password })
  if (signIn.status !== 200)
    throw new Error(`Sign-in failed (${signIn.status}): ${JSON.stringify(signIn.body)}`)

  clearOutbox()
  const user = await User.findOne({ email: credentials.email.toLowerCase() }).orFail()
  return { agent, user, ...credentials }
}
