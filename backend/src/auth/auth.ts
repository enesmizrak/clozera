import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { APIError } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import type { Db, MongoClient } from 'mongodb'
import { env } from '../config/env.ts'
import { passwordHasher } from './passwords.ts'

export const AUTH_BASE_PATH = '/api/auth'
const FIFTEEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 15

/** Better Auth stores users in the Mongoose `users` collection and its own data in `auth_*` collections. */
export function mongoAuthDatabase(db: Db, client?: MongoClient): NonNullable<BetterAuthOptions['database']> {
  // Local Docker runs a standalone mongod, which cannot run transactions.
  return mongodbAdapter(
    db,
    env.MONGODB_TRANSACTIONS && client ? { client, transaction: true } : { transaction: false }
  )
}

export function createAuth(database: NonNullable<BetterAuthOptions['database']>) {
  return betterAuth({
    appName: 'Clozera',
    baseURL: env.authUrl,
    basePath: AUTH_BASE_PATH,
    secret: env.authSecret,
    trustedOrigins: [env.FRONTEND_URL],
    telemetry: { enabled: false },
    database,
    // Users share the Mongoose `users` collection so existing ObjectId references keep working.
    user: {
      modelName: 'users',
      additionalFields: {
        role: { type: ['user', 'admin'], required: false, defaultValue: 'user', input: false },
        timezone: { type: 'string', required: false, defaultValue: 'UTC', input: true },
      },
    },
    session: {
      modelName: 'auth_sessions',
      expiresIn: FIFTEEN_DAYS_IN_SECONDS,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: { modelName: 'auth_accounts' },
    verification: { modelName: 'auth_verifications' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: passwordHasher,
    },
    plugins: [username()],
    databaseHooks: {
      user: {
        create: {
          // Learning features address people by username, so every account needs one.
          async before(user) {
            if (typeof user.username !== 'string' || !user.username) {
              throw new APIError('BAD_REQUEST', { message: 'Username is required.' })
            }
          },
        },
      },
    },
    advanced: { cookiePrefix: 'clozera' },
  })
}

export type Auth = ReturnType<typeof createAuth>
