import { describe, expect, it } from 'vite-plus/test'
import { SECURITY_HEADERS, withSecurityHeaders } from './security-headers'

describe('withSecurityHeaders', () => {
  it('adds all hardening headers to a plain response', () => {
    const response = withSecurityHeaders(new Response('x'))
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value)
    }
  })

  it('keeps a header the route already set', () => {
    const response = withSecurityHeaders(new Response('x', { headers: { 'Referrer-Policy': 'no-referrer' } }))
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('adds the headers to a response with immutable headers', () => {
    const response = withSecurityHeaders(Response.redirect('https://example.com/', 302))
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('https://example.com/')
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value)
    }
  })
})
