import { describe, expect, it } from 'vite-plus/test'
import { authErrorMessage } from './auth-errors'

describe('authErrorMessage', () => {
  it('maps Better Auth codes to learner-facing messages', () => {
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 }, 'x')).toBe(
      'Invalid email or password.'
    )
    expect(authErrorMessage({ code: 'INVALID_TOKEN', status: 400 }, 'x')).toBe(
      'This link is invalid or has expired.'
    )
  })

  it('explains rate limits and falls back for unknown errors', () => {
    expect(authErrorMessage({ status: 429 }, 'x')).toMatch(/Too many attempts/)
    expect(authErrorMessage({ code: 'SOMETHING_NEW', message: 'Server says no.' }, 'x')).toBe(
      'Server says no.'
    )
    expect(authErrorMessage(null, 'Fallback.')).toBe('Fallback.')
  })
})
