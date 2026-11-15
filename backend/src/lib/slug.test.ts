import { describe, expect, it } from 'vite-plus/test'
import { slugify } from './slug.ts'

describe('slugify', () => {
  it('lowercases and hyphenates Latin text', () => {
    expect(slugify('Travel Phrases')).toBe('travel-phrases')
  })

  it('removes accents', () => {
    expect(slugify('Café crème')).toBe('cafe-creme')
    expect(slugify('İstanbul Şehri')).toBe('istanbul-sehri')
  })

  it('keeps Cyrillic letters', () => {
    expect(slugify('Глаголы движения')).toBe('глаголы-движения')
  })

  it('keeps CJK characters', () => {
    expect(slugify('日本語 の 基本')).toBe('日本語-の-基本')
  })

  it('returns an empty string when no letters or digits remain', () => {
    expect(slugify('!!!')).toBe('')
  })

  it('limits the length without leaving a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40))
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })
})
