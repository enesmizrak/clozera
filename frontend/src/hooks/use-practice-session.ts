import type { SentenceDto } from '@clozera/shared'
import { useMemo, useReducer } from 'react'
import {
  type PracticeMode,
  PRACTICE_MODES,
  answerMatchesSentence,
  choiceSlotsForSentence,
  sessionSentencesFromCollection,
} from '@/lib/practice-session'

interface SessionState {
  questions: SentenceDto[]
  index: number
  answer: string
  result: boolean | null
  revealed: boolean
  correct: number
}

type SessionAction =
  | { type: 'answer'; value: string }
  | { type: 'grade'; matches: boolean; answer?: string }
  | { type: 'reveal' }
  | { type: 'next' }
  | { type: 'restart'; questions: SentenceDto[] }

const freshRound = (questions: SentenceDto[]): SessionState => ({
  questions,
  index: 0,
  answer: '',
  result: null,
  revealed: false,
  correct: 0,
})

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer':
      return { ...state, answer: action.value }
    case 'grade':
      return {
        ...state,
        answer: action.answer ?? state.answer,
        result: action.matches,
        revealed: true,
        correct: state.correct + (action.matches ? 1 : 0),
      }
    case 'reveal':
      return { ...state, revealed: true }
    case 'next':
      return { ...state, index: state.index + 1, answer: '', result: null, revealed: false }
    case 'restart':
      return freshRound(action.questions)
  }
}

/**
 * Runs one practice round over a random sample of the collection's sentences.
 * The interface is identical for every answer mode; no practice data is persisted yet.
 */
export function usePracticeSession({
  sentences,
  mode,
  limit,
}: {
  sentences: readonly SentenceDto[]
  mode: PracticeMode
  limit: number
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    freshRound(sessionSentencesFromCollection(sentences, limit))
  )
  const sentence = state.questions[state.index]
  const choices = useMemo(
    () => (sentence ? choiceSlotsForSentence(sentence).filter(choice => !choice.disabled) : []),
    [sentence]
  )
  const total = state.questions.length

  return {
    ...state,
    sentence,
    choices,
    total,
    attempted: Math.min(total, state.index + (state.result === null ? 0 : 1)),
    complete: state.index >= total,
    setAnswer: (value: string) => dispatch({ type: 'answer', value }),
    check: (value = state.answer) => {
      if (!sentence || state.result !== null || mode === PRACTICE_MODES.flashcard || !value.trim()) return
      dispatch({ type: 'grade', matches: answerMatchesSentence(sentence, value), answer: value })
    },
    rateFlashcard: (remembered: boolean) => {
      if (!sentence || mode !== PRACTICE_MODES.flashcard || !state.revealed || state.result !== null) return
      dispatch({ type: 'grade', matches: remembered })
    },
    reveal: () => dispatch({ type: 'reveal' }),
    next: () => {
      if (state.result !== null) dispatch({ type: 'next' })
    },
    restart: () => dispatch({ type: 'restart', questions: sessionSentencesFromCollection(sentences, limit) }),
  }
}

export type PracticeSession = ReturnType<typeof usePracticeSession>
