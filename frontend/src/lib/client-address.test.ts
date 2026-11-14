import { describe, expect, it } from 'vite-plus/test'
import { clientAddressConfig, resolveClientAddress } from './client-address'

const socket = { header: '', trustedHops: 0 }
const cloudflare = { header: 'cf-connecting-ip', trustedHops: 0 }

describe('clientAddressConfig', () => {
  it('parses the environment defensively', () => {
    expect(clientAddressConfig({})).toEqual({ header: '', trustedHops: 0 })
    expect(clientAddressConfig({ TRUSTED_PROXY_HOPS: '-2' }).trustedHops).toBe(0)
    expect(clientAddressConfig({ CLIENT_IP_HEADER: ' CF-Connecting-IP ' }).header).toBe('cf-connecting-ip')
  })
})

describe('resolveClientAddress', () => {
  it('uses the socket address and ignores a forged x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6' })
    expect(resolveClientAddress(headers, '10.0.0.5', socket)).toBe('10.0.0.5')
  })

  it('uses the configured header and ignores x-forwarded-for', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6' })
    expect(resolveClientAddress(headers, '10.0.0.5', cloudflare)).toBe('203.0.113.7')
  })

  it('returns undefined for a non-IP or missing header value', () => {
    const forged = new Headers({ 'cf-connecting-ip': 'not-an-ip' })
    expect(resolveClientAddress(forged, '10.0.0.5', cloudflare)).toBeUndefined()
    expect(resolveClientAddress(new Headers(), '10.0.0.5', cloudflare)).toBeUndefined()
  })

  it('counts trusted hops from the right of x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' })
    expect(resolveClientAddress(headers, undefined, { header: '', trustedHops: 1 })).toBe('203.0.113.7')
    expect(resolveClientAddress(headers, undefined, { header: '', trustedHops: 2 })).toBe('6.6.6.6')
    expect(resolveClientAddress(headers, undefined, { header: '', trustedHops: 3 })).toBeUndefined()
  })

  it('accepts IPv6 addresses', () => {
    const headers = new Headers({ 'cf-connecting-ip': '2001:db8::1' })
    expect(resolveClientAddress(headers, undefined, cloudflare)).toBe('2001:db8::1')
  })
})
