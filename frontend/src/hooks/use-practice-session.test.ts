import type { SentenceDto } from '@clozera/shared'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { usePracticeSession } from './use-practice-session'

const sentences: SentenceDto[] = [
  {
    id: '1',
    text: 'Ich {{lerne}}.',
    translation: 'I learn.',
    cloze: 'lerne',
    alternativeAnswers: ['studiere'],
    multipleChoiceOptions: ['reise'],
    hint: '',
    notes: '',
  },
  {
    id: '2',
    text: 'Wir {{reisen}}.',
    translation: 'We travel.',
    cloze: 'reisen',
    alternativeAnswers: [],
    multipleChoiceOptions: [],
    hint: '',
    notes: '',
  },
]

describe('usePracticeSession', () => {
  it('grades typed answers and finishes the round', () => {
    const { result } = renderHook(() => usePracticeSession({ sentences, mode: 'typed', limit: 5 }))
    expect(result.current.total).toBe(2)

    for (const answerFor of [() => 'wrong', () => result.current.sentence?.cloze ?? '']) {
      act(() => result.current.setAnswer(answerFor()))
      act(() => result.current.check())
      expect(result.current.revealed).toBe(true)
      act(() => result.current.next())
    }

    expect(result.current.complete).toBe(true)
    expect(result.current.correct).toBe(1)
    expect(result.current.attempted).toBe(2)
  })

  it('only rates flashcards after the answer is revealed', () => {
    const { result } = renderHook(() => usePracticeSession({ sentences, mode: 'flashcard', limit: 5 }))

    act(() => result.current.rateFlashcard(true))
    expect(result.current.result).toBeNull()

    act(() => result.current.reveal())
    act(() => result.current.rateFlashcard(true))
    expect(result.current.result).toBe(true)
    expect(result.current.correct).toBe(1)
  })

  it('restarts with a fresh round', () => {
    const { result } = renderHook(() => usePracticeSession({ sentences, mode: 'choice', limit: 5 }))
    act(() => result.current.check(result.current.choices[0]?.label ?? ''))
    act(() => result.current.next())
    act(() => result.current.restart())

    expect(result.current.index).toBe(0)
    expect(result.current.correct).toBe(0)
    expect(result.current.result).toBeNull()
  })
})
