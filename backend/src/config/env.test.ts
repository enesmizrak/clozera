import { describe, expect, it } from 'vite-plus/test'
import { isDevelopmentSecret, parseEnv } from './env.ts'

const production = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://clozera.example',
  RESEND_API_KEY: 'resend-key',
}

describe('parseEnv', () => {
  it('requires BETTER_AUTH_SECRET in production', () => {
    expect(() => parseEnv(production)).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('rejects a short BETTER_AUTH_SECRET in production', () => {
    expect(() => parseEnv({ ...production, BETTER_AUTH_SECRET: 'x'.repeat(31) })).toThrow(
      /BETTER_AUTH_SECRET/
    )
  })

  it('accepts a 32 character BETTER_AUTH_SECRET in production', () => {
    const secret = 'x'.repeat(32)
    expect(parseEnv({ ...production, BETTER_AUTH_SECRET: secret }).authSecret).toBe(secret)
  })

  it('no longer reads SESSION_SECRET', () => {
    expect(() => parseEnv({ ...production, SESSION_SECRET: 'x'.repeat(32) })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('falls back to the development secret in development', () => {
    expect(isDevelopmentSecret(parseEnv({ NODE_ENV: 'development' }).authSecret)).toBe(true)
  })

  it('requires NODE_ENV', () => {
    expect(() => parseEnv({})).toThrow(/NODE_ENV/)
  })

  it('refuses the development secret in production', () => {
    const secret = parseEnv({ NODE_ENV: 'development' }).authSecret
    expect(() => parseEnv({ ...production, BETTER_AUTH_SECRET: secret })).toThrow(/development secret/)
  })
})
