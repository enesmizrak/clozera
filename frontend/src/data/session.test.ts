import { describe, expect, it } from 'vite-plus/test'
import { homePathFor, safeRedirect } from './session'

describe('session routing', () => {
  it('sends learners without a language pair to the language picker', () => {
    expect(homePathFor({ selectedLanguagePair: null })).toBe('/languages')
    expect(homePathFor({ selectedLanguagePair: { id: '1', slug: 'deu-eng', name: 'German' } })).toBe('/dashboard')
  })

  it('only accepts same-origin redirect paths', () => {
    expect(safeRedirect('/dashboard?tab=collections')).toBe('/dashboard?tab=collections')
    for (const value of ['//evil.example', 'https://evil.example', '/\\evil', '/a b', undefined, 42]) {
      expect(safeRedirect(value)).toBeNull()
    }
  })
})
