import { z } from 'zod'

const DEVELOPMENT_SECRET = 'clozera-development-only-secret-do-not-use-in-production'

function envSchema(source: Record<string, string | undefined>) {
  return z
    .object({
      NODE_ENV: z.enum(['development', 'test', 'production'], {
        error: 'NODE_ENV must be set to development, test or production.',
      }),
      PORT: z.coerce.number().int().min(0).default(3000),
      MONGODB_CONNECTION_STRING: z.string().trim().min(1).optional(),
      /** Public origin of the web app. Browsers reach the API through its `/api` proxy. */
      FRONTEND_URL: z.url().default('http://localhost:5173'),
      /** Public URL where Better Auth is reachable. Defaults to FRONTEND_URL because `/api/auth` is proxied. */
      BETTER_AUTH_URL: z.url().optional(),
      BETTER_AUTH_SECRET: z.string().min(32).optional(),
      MONGODB_TRANSACTIONS: z.stringbool().default(false),
      /** `resend` (production), `smtp` (local Mailpit) or `console`. Tests always use an in-memory outbox. */
      EMAIL_TRANSPORT: z.preprocess(
        value => (typeof value === 'string' ? value.trim() || undefined : value),
        z.enum(['console', 'smtp', 'resend']).optional()
      ),
      EMAIL_FROM: z.string().trim().min(3).default('Clozera <no-reply@clozera.app>'),
      EMAIL_REPLY_TO: z.email().optional(),
      RESEND_API_KEY: z.string().trim().min(1).optional(),
      SMTP_URL: z.url().optional(),
    })
    .transform((value, context) => {
      const secret = value.BETTER_AUTH_SECRET
      const isProduction = value.NODE_ENV === 'production'

      if (isProduction && !secret) {
        context.addIssue({ code: 'custom', message: 'BETTER_AUTH_SECRET must be defined in production.' })
      }
      if (isProduction && secret === DEVELOPMENT_SECRET) {
        context.addIssue({
          code: 'custom',
          message: 'BETTER_AUTH_SECRET must not be the development secret.',
        })
      }
      if (isProduction && !source.FRONTEND_URL) {
        context.addIssue({ code: 'custom', message: 'FRONTEND_URL must be defined in production.' })
      }

      const emailTransport =
        value.NODE_ENV === 'test'
          ? 'memory'
          : (value.EMAIL_TRANSPORT ?? (isProduction ? 'resend' : 'console'))
      if (emailTransport === 'resend' && !value.RESEND_API_KEY) {
        context.addIssue({
          code: 'custom',
          message: 'RESEND_API_KEY must be defined when emails are sent with Resend.',
        })
      }
      if (emailTransport === 'smtp' && !value.SMTP_URL) {
        context.addIssue({ code: 'custom', message: 'SMTP_URL must be defined when EMAIL_TRANSPORT=smtp.' })
      }
      if (isProduction && emailTransport === 'console') {
        context.addIssue({
          code: 'custom',
          message: 'Production must deliver emails; use EMAIL_TRANSPORT=resend.',
        })
      }

      return {
        ...value,
        emailTransport,
        isProduction,
        isTest: value.NODE_ENV === 'test',
        authSecret: secret ?? DEVELOPMENT_SECRET,
        authUrl: value.BETTER_AUTH_URL ?? value.FRONTEND_URL,
      }
    })
}

export type Env = z.infer<ReturnType<typeof envSchema>>

export function isDevelopmentSecret(secret: string): boolean {
  return secret === DEVELOPMENT_SECRET
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema(source).safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env = parseEnv(process.env)
