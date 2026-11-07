const CLOZE_PATTERN = /\{\{(.*?)\}\}/g

export interface SentencePart {
  text: string
  isCloze: boolean
}

export interface SentenceAuthoringPayload {
  text: string
  translation: string
  cloze: string
  alternativeAnswers: string[]
  multipleChoiceOptions: string[]
  hint: string
  notes: string
}

/** Text from untrusted input: strings and numbers are kept, anything else becomes empty. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

/** Returns the single `{{cloze}}` answer in a sentence, or an empty string when there is not exactly one. */
export function extractCloze(text: unknown): string {
  const matches = Array.from(textOf(text).matchAll(CLOZE_PATTERN))
  return matches.length === 1 ? (matches[0]?.[1] ?? '').trim() : ''
}

export function sentenceParts(text: unknown): SentencePart[] {
  return textOf(text)
    .split(/(\{\{.*?\}\})/g)
    .filter(Boolean)
    .map(part => {
      const isCloze = part.startsWith('{{') && part.endsWith('}}')
      return { text: isCloze ? part.slice(2, -2) : part, isCloze }
    })
}

/** Accepts a list or a comma/newline separated string and returns trimmed, non-empty items. */
export function normalizeList(value: unknown): string[] {
  const items = Array.isArray(value) ? value.map(textOf) : textOf(value).split(/\r?\n|,/)
  return items.map(item => item.trim()).filter(Boolean)
}

export function listToText(value: readonly string[] | undefined): string {
  return (value ?? []).join(', ')
}

export function normalizeSentencePayload(
  payload: Partial<Record<keyof SentenceAuthoringPayload, unknown>> = {}
) {
  const text = textOf(payload.text).trim()

  return {
    text,
    translation: textOf(payload.translation).trim(),
    cloze: extractCloze(text),
    alternativeAnswers: normalizeList(payload.alternativeAnswers),
    multipleChoiceOptions: normalizeList(payload.multipleChoiceOptions),
    hint: textOf(payload.hint).trim(),
    notes: textOf(payload.notes).trim(),
  } satisfies SentenceAuthoringPayload
}
