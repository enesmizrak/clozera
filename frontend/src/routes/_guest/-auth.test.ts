import { describe, expect, it } from 'vite-plus/test'
import { verificationCallbackURL } from './-auth'

describe('verificationCallbackURL', () => {
  it('is the bare verification path without a redirect', () => {
    expect(verificationCallbackURL(null)).toBe('/email-verified')
  })

  it('carries the redirect encoded', () => {
    expect(verificationCallbackURL('/dashboard?tab=collections')).toBe(
      '/email-verified?redirect=%2Fdashboard%3Ftab%3Dcollections'
    )
  })
})
