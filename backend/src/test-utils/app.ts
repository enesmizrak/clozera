import mongoose from 'mongoose'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../app.ts'
import { createAuth, mongoAuthDatabase } from '../auth/auth.ts'
import { nativeDatabase } from '../db/connection.ts'
import { User } from '../models/user.ts'

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

/** Signs up through Better Auth and returns a cookie-carrying agent plus the stored user. */
export async function signUpAs(app: Express, input: TestUserInput = {}) {
  const credentials = {
    name: input.name ?? 'Test User',
    username: input.username ?? 'testuser',
    email: input.email ?? 'test@example.com',
    password: input.password ?? 'secret123',
    timezone: input.timezone ?? 'UTC',
  }
  const agent = request.agent(app)
  const response = await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .send(credentials)
  if (response.status !== 200) {
    throw new Error(`Sign-up failed (${response.status}): ${JSON.stringify(response.body)}`)
  }

  if (input.role === 'admin') await User.updateOne({ email: credentials.email }, { role: 'admin' })
  const user = await User.findOne({ email: credentials.email }).orFail()
  return { agent, user, ...credentials }
}
