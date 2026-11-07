import type { SentenceDto } from '@clozera/shared'

export const DEFAULT_SESSION_LIMIT = 10
const DEFAULT_CHOICE_COUNT = 4

export const SESSION_LIMIT_OPTIONS = [5, 10, 20] as const

export const PRACTICE_MODES = {
  typed: 'typed',
  choice: 'choice',
  flashcard: 'flashcard',
} as const

export type PracticeMode = (typeof PRACTICE_MODES)[keyof typeof PRACTICE_MODES]

type Random = () => number

export function practiceModeFromValue(value: unknown): PracticeMode {
  return Object.values(PRACTICE_MODES).includes(value as PracticeMode)
    ? (value as PracticeMode)
    : PRACTICE_MODES.typed
}

export function sessionLimitFromValue(value: unknown): number {
  const limit = Number(value)
  return (SESSION_LIMIT_OPTIONS as readonly number[]).includes(limit) ? limit : DEFAULT_SESSION_LIMIT
}

export function normalizedAnswer(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase()
}

export function answerMatchesSentence(
  sentence: Pick<SentenceDto, 'cloze' | 'alternativeAnswers'> | undefined,
  answer: string
): boolean {
  const normalized = normalizedAnswer(answer)
  const accepted = [sentence?.cloze, ...(sentence?.alternativeAnswers ?? [])].map(normalizedAnswer)
  return Boolean(normalized && accepted.includes(normalized))
}

export function shuffledItems<T>(items: readonly T[] = [], random: Random = Math.random): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T]
  }
  return shuffled
}

export function sessionSentencesFromCollection<T>(
  sentences: readonly T[] = [],
  limit = DEFAULT_SESSION_LIMIT,
  random: Random = Math.random
): T[] {
  return shuffledItems(sentences, random).slice(0, limit)
}

export interface ChoiceSlot {
  id: string
  label: string
  disabled: boolean
  isCorrect: boolean
}

export function choiceSlotsForSentence(
  sentence: Pick<SentenceDto, 'cloze' | 'multipleChoiceOptions'> | undefined,
  choiceCount = DEFAULT_CHOICE_COUNT,
  random: Random = Math.random
): ChoiceSlot[] {
  const correctAnswer = String(sentence?.cloze ?? '').trim()
  const uniqueOptions = new Set((sentence?.multipleChoiceOptions ?? []).map(option => option.trim()))
  const distractors = shuffledItems(
    [...uniqueOptions].filter(
      option => option && normalizedAnswer(option) !== normalizedAnswer(correctAnswer)
    ),
    random
  ).slice(0, Math.max(choiceCount - 1, 0))
  const activeOptions = shuffledItems([correctAnswer, ...distractors].filter(Boolean), random)
  const emptyOptions = Array.from({ length: Math.max(choiceCount - activeOptions.length, 0) }, () => '')

  return [...activeOptions, ...emptyOptions].map((label, index) => ({
    id: label ? `choice-${index}-${normalizedAnswer(label)}` : `empty-${index}`,
    label,
    disabled: !label,
    isCorrect: normalizedAnswer(label) === normalizedAnswer(correctAnswer),
  }))
}
