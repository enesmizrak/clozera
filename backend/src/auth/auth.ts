import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { APIError } from 'better-auth/api'
import { username } from 'better-auth/plugins'
import type { Db, MongoClient } from 'mongodb'
import { env } from '../config/env.ts'
import { createMailer, type Mailer } from '../email/mailer.ts'

export const AUTH_BASE_PATH = '/api/auth'
const ONE_HOUR = 60 * 60
const ONE_DAY = 24 * ONE_HOUR
const FIFTEEN_DAYS = 15 * ONE_DAY

/** Better Auth stores users in the Mongoose `users` collection and its own data in `auth_*` collections. */
export function mongoAuthDatabase(db: Db, client?: MongoClient): NonNullable<BetterAuthOptions['database']> {
  // Local Docker runs a standalone mongod, which cannot run transactions.
  return mongodbAdapter(
    db,
    env.MONGODB_TRANSACTIONS && client ? { client, transaction: true } : { transaction: false }
  )
}

export function createAuth(
  database: NonNullable<BetterAuthOptions['database']>,
  mailer: Mailer = createMailer({ background: true })
) {
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
      // Two steps: the current address approves the change, then the new address confirms itself.
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
          mailer.emailChangeConfirmation(user, newEmail, url),
      },
    },
    session: {
      modelName: 'auth_sessions',
      expiresIn: FIFTEEN_DAYS,
      // No cookie cache: revoked sessions (password reset, sign-out elsewhere) must stop working at once.
    },
    account: { modelName: 'auth_accounts' },
    verification: { modelName: 'auth_verifications' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Community collections are public, so every account proves it owns its address.
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: ONE_HOUR,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => mailer.passwordReset(user, url),
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in unverified re-sends the link, so an expired email is never a dead end.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: ONE_DAY,
      sendVerificationEmail: ({ user, url }) => mailer.verification(user, url),
    },
    rateLimit: {
      // Enabled in production by default. Limits are per IP and kept in memory per instance.
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/send-verification-email': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/change-email': { window: 60, max: 3 },
      },
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
    advanced: {
      cookiePrefix: 'clozera',
      // The web app's /api proxy replaces X-Forwarded-For with the one client address it verified (frontend/src/lib/client-address.ts). The API must not be publicly reachable.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
