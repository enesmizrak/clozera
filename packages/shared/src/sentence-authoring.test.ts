import { describe, expect, it } from 'vite-plus/test'
import { sentenceSchema } from './schemas.ts'
import {
  extractCloze,
  listToText,
  normalizeList,
  normalizeSentencePayload,
  sentenceParts,
} from './sentence-authoring.ts'

describe('sentence authoring', () => {
  it('extracts exactly one cloze marker', () => {
    expect(extractCloze('Ich {{lerne}} heute.')).toBe('lerne')
    expect(extractCloze('Ich {{ lerne }} heute.')).toBe('lerne')
    expect(extractCloze('Ich lerne heute.')).toBe('')
    expect(extractCloze('Ich {{lerne}} {{heute}}.')).toBe('')
    expect(extractCloze(undefined)).toBe('')
  })

  it('splits sentences into preview parts', () => {
    expect(sentenceParts('Ich {{lerne}} heute.')).toEqual([
      { text: 'Ich ', isCloze: false },
      { text: 'lerne', isCloze: true },
      { text: ' heute.', isCloze: false },
    ])
  })

  it('normalizes answer lists from arrays and separated text', () => {
    expect(normalizeList('lerne, reise\nspreche')).toEqual(['lerne', 'reise', 'spreche'])
    expect(normalizeList([' a ', '', 'b'])).toEqual(['a', 'b'])
    expect(normalizeList(undefined)).toEqual([])
    expect(listToText(['lerne', 'reise'])).toBe('lerne, reise')
  })

  it('normalizes sentence payloads', () => {
    expect(
      normalizeSentencePayload({
        text: ' Ich {{lerne}} heute. ',
        translation: ' I learn today. ',
        alternativeAnswers: 'studiere, uebe',
        multipleChoiceOptions: ['lerne', 'reise'],
        hint: ' verb ',
      })
    ).toEqual({
      text: 'Ich {{lerne}} heute.',
      translation: 'I learn today.',
      cloze: 'lerne',
      alternativeAnswers: ['studiere', 'uebe'],
      multipleChoiceOptions: ['lerne', 'reise'],
      hint: 'verb',
      notes: '',
    })
  })

  it('validates sentence input with a single cloze marker', () => {
    expect(sentenceSchema.safeParse({ text: 'No marker', translation: 'x' }).success).toBe(false)
    expect(
      sentenceSchema.parse({ text: 'Ich {{lerne}}.', translation: 'I learn.', alternativeAnswers: 'a\nb' })
    ).toMatchObject({ alternativeAnswers: ['a', 'b'], multipleChoiceOptions: [], hint: '', notes: '' })
  })
})

describe('untrusted input', () => {
  it('ignores non-text values instead of stringifying them', () => {
    expect(normalizeList([{ a: 1 }, 'ok', 3])).toEqual(['ok', '3'])
    expect(normalizeSentencePayload({ text: { $gt: '' }, translation: 'x' }).text).toBe('')
  })
})
