import { describe, expect, it } from 'vite-plus/test'
import { changeEmailConfirmation, resetPasswordEmail, verifyEmail } from './index.ts'

const appUrl = 'https://clozera.app'

describe('email templates', () => {
  it('renders the verification email with its link in HTML and plain text', async () => {
    const url = 'https://clozera.app/api/auth/verify-email?token=abc&callbackURL=%2Femail-verified'
    const email = await verifyEmail({ appUrl, name: 'Ada', url, reason: 'signup' })

    expect(email.subject).toBe('Confirm your email for Clozera')
    expect(email.html).toContain(
      'href="https://clozera.app/api/auth/verify-email?token=abc&amp;callbackURL=%2Femail-verified"'
    )
    expect(email.text).toContain(url)
    expect(email.text).toContain('Hi Ada,')
  })

  it('words the verification email for an address change', async () => {
    const email = await verifyEmail({ appUrl, name: 'Ada', url: 'https://x.test/v', reason: 'change' })
    expect(email.subject).toBe('Confirm your new email address')
    expect(email.text).toContain('finish changing the email')
  })

  it('escapes learner-provided names', async () => {
    const email = await resetPasswordEmail({
      appUrl,
      name: '<script>alert(1)</script>',
      url: 'https://x.test/r',
    })
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('names the new address in the change confirmation', async () => {
    const email = await changeEmailConfirmation({
      appUrl,
      name: 'Ada',
      newEmail: 'ada@new.example',
      url: 'https://x.test/c',
    })
    expect(email.text).toContain('ada@new.example')
    expect(email.subject).toContain('email change')
  })
})
