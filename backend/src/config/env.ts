import { z } from 'zod'

const DEVELOPMENT_SECRET = 'clozera-development-only-secret-do-not-use-in-production'

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).default(3000),
    MONGODB_CONNECTION_STRING: z.string().trim().min(1).optional(),
    /** Public origin of the web app. Browsers reach the API through its `/api` proxy. */
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    /** Public URL where Better Auth is reachable. Defaults to FRONTEND_URL because `/api/auth` is proxied. */
    BETTER_AUTH_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    /** @deprecated Accepted as a fallback for BETTER_AUTH_SECRET while environments are migrated. */
    SESSION_SECRET: z.string().min(1).optional(),
    MONGODB_TRANSACTIONS: z.stringbool().default(false),
  })
  .transform((value, context) => {
    const secret = value.BETTER_AUTH_SECRET ?? value.SESSION_SECRET
    const isProduction = value.NODE_ENV === 'production'

    if (isProduction && !secret) {
      context.addIssue({ code: 'custom', message: 'BETTER_AUTH_SECRET must be defined in production.' })
    }
    if (isProduction && !process.env.FRONTEND_URL) {
      context.addIssue({ code: 'custom', message: 'FRONTEND_URL must be defined in production.' })
    }

    return {
      ...value,
      isProduction,
      isTest: value.NODE_ENV === 'test',
      authSecret: secret ?? DEVELOPMENT_SECRET,
      authUrl: value.BETTER_AUTH_URL ?? value.FRONTEND_URL,
    }
  })

export type Env = z.infer<typeof schema>

function loadEnv(): Env {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

export const env = loadEnv()
