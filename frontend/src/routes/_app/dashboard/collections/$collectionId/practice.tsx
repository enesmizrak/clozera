import { type SentenceDto, sentenceParts } from '@clozera/shared'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, Eye, Lightbulb, RotateCcw, X } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Markdown } from '@/components/markdown'
import { PageSpinner } from '@/components/page-status'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useChoiceHotkeys } from '@/hooks/use-choice-hotkeys'
import { type PracticeSession, usePracticeSession } from '@/hooks/use-practice-session'
import { practiceModeOption } from '@/lib/practice-options'
import {
  DEFAULT_SESSION_LIMIT,
  PRACTICE_MODES,
  type PracticeMode,
  practiceModeFromValue,
  sessionLimitFromValue,
} from '@/lib/practice-session'
import { cn } from '@/lib/utils'
import { useCollectionSentences, useCurrentCollection } from './route'

const practiceSearchSchema = z.object({
  mode: z.string().optional().transform(practiceModeFromValue).catch(PRACTICE_MODES.typed),
  limit: z.coerce.number().optional().transform(sessionLimitFromValue).catch(DEFAULT_SESSION_LIMIT),
})

export const Route = createFileRoute('/_app/dashboard/collections/$collectionId/practice')({
  validateSearch: practiceSearchSchema,
  component: PracticePage,
})

function PracticePage() {
  const { collectionId } = Route.useParams()
  const { mode, limit } = Route.useSearch()
  const collection = useCurrentCollection()
  const { sentences, isReady } = useCollectionSentences()

  return (
    <main className="page-shell space-y-6" data-width="practice">
      <Link
        to="/dashboard/collections/$collectionId"
        params={{ collectionId }}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        <ArrowLeft />
        Back to collection
      </Link>
      {isReady ? (
        <PracticeRound
          key={`${mode}:${limit}`}
          name={collection.name}
          sentences={sentences}
          mode={mode}
          limit={limit}
        />
      ) : (
        <PageSpinner label="Loading practice…" />
      )}
    </main>
  )
}

function PracticeRound({
  name,
  sentences,
  mode,
  limit,
}: {
  name: string
  sentences: SentenceDto[]
  mode: PracticeMode
  limit: number
}) {
  const session = usePracticeSession({ sentences, mode, limit })
  const option = practiceModeOption(mode)
  const ModeIcon = option.icon
  const flashcard = mode === PRACTICE_MODES.flashcard
  const { collectionId } = Route.useParams()

  return (
    <>
      <header className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="secondary">
              <ModeIcon />
              {option.label}
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          </div>
          <p
            aria-label={`${session.correct} ${flashcard ? 'remembered' : 'correct'}, ${session.attempted - session.correct} ${flashcard ? 'to practice' : 'incorrect'}`}
            className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm tabular-nums"
          >
            <span className="flex items-center gap-1.5 text-success">
              <Check className="size-4" />
              {session.correct}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {flashcard ? <RotateCcw className="size-4" /> : <X className="size-4" />}
              {session.attempted - session.correct}
            </span>
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Session progress</span>
            <span>
              {session.attempted} / {session.total} completed
            </span>
          </div>
          <Progress
            value={session.complete ? 100 : session.total ? (session.attempted / session.total) * 100 : 0}
            aria-label="Practice progress"
          />
        </div>
      </header>
      {session.complete ? (
        <Card className="text-center">
          <CardHeader className="gap-3">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Check />
            </div>
            <CardDescription>Session complete</CardDescription>
            <CardTitle className="text-3xl">
              <h2>
                {session.correct} / {session.total} {flashcard ? 'remembered' : 'correct'}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              {session.total
                ? 'A little practice goes a long way. Try a fresh set or return to your collection.'
                : 'This collection has no sentences yet.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button disabled={!session.total} onClick={session.restart}>
                <RotateCcw />
                Practice again
              </Button>
              <Link
                to="/dashboard/collections/$collectionId"
                params={{ collectionId }}
                className={buttonVariants({ variant: 'outline' })}
              >
                Back to collection
                <ArrowRight />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        session.sentence && (
          <QuestionCard key={session.index} session={session} sentence={session.sentence} mode={mode} />
        )
      )}
    </>
  )
}

function QuestionCard({
  session,
  sentence,
  mode,
}: {
  session: PracticeSession
  sentence: SentenceDto
  mode: PracticeMode
}) {
  const option = practiceModeOption(mode)
  const flashcard = mode === PRACTICE_MODES.flashcard
  const choiceMode = mode === PRACTICE_MODES.choice
  const typed = mode === PRACTICE_MODES.typed
  const { result, revealed } = session
  const [hintVisible, setHintVisible] = useState(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const ratingButton = useRef<HTMLButtonElement>(null)
  const isLast = session.index + 1 === session.total

  useEffect(() => {
    if (result !== null) nextButton.current?.focus()
    else if (flashcard && revealed) ratingButton.current?.focus()
  }, [result, revealed, flashcard])

  const { choices, check } = session
  useChoiceHotkeys(choices, choice => check(choice.label), choiceMode && result === null)

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="space-y-4 pb-6 sm:pb-8">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>
            Sentence {session.index + 1} / {session.total}
          </CardDescription>
          <Badge variant="outline">{option.badge}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{option.instruction}</p>
        <CardTitle className="pt-2 text-2xl leading-relaxed sm:text-3xl" aria-label="Practice sentence">
          {sentenceParts(sentence.text).map((part, index) =>
            !part.isCloze ? (
              <span key={index}>{part.text}</span>
            ) : typed && result === null ? (
              <Input
                key={index}
                // The answer field is the only control on a typed question; focus it for keyboard-only practice.
                // oxlint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                form="typed-answer"
                name="answer"
                aria-label="Missing word"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="cloze-input"
                style={
                  {
                    '--cloze-chars': Math.min(24, Math.max(4, Array.from(session.answer).length + 1)),
                  } as CSSProperties
                }
                value={session.answer}
                onChange={event => session.setAnswer(event.target.value)}
                onKeyDown={event => {
                  // Do not submit while an input method editor is composing a character.
                  if (
                    event.key === 'Enter' &&
                    (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
                  )
                    event.preventDefault()
                }}
              />
            ) : (
              <span
                key={index}
                className={revealed ? 'cloze-answer' : 'cloze-blank'}
                data-result={result === true ? 'correct' : result === false ? 'incorrect' : 'revealed'}
              >
                {revealed ? (
                  typed && result === true ? (
                    session.answer.trim()
                  ) : (
                    part.text
                  )
                ) : (
                  <span className="sr-only">missing word</span>
                )}
              </span>
            )
          )}
        </CardTitle>
        <p className="text-base leading-relaxed text-muted-foreground">{sentence.translation}</p>
        {result !== null && (
          <output
            aria-live="polite"
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
              result ? 'text-success' : flashcard ? 'text-muted-foreground' : 'text-destructive'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {result ? (
                <Check className="size-4" aria-hidden="true" />
              ) : flashcard ? (
                <RotateCcw className="size-4" aria-hidden="true" />
              ) : (
                <X className="size-4" aria-hidden="true" />
              )}
              <span>
                {flashcard
                  ? result
                    ? 'Remembered'
                    : 'Keep practicing'
                  : result
                    ? 'Correct'
                    : 'Correct answer'}
              </span>
            </span>
            {!flashcard && result === false && (
              <>
                <span className="text-muted-foreground">Your answer: {session.answer}</span>
                <span className="sr-only">Correct answer: {sentence.cloze}</span>
              </>
            )}
          </output>
        )}
        {sentence.hint && !revealed && (
          <div>
            {hintVisible ? (
              <p className="rounded-md bg-muted p-3 text-sm">
                <Lightbulb className="mr-2 inline size-4 text-primary" />
                {sentence.hint}
              </p>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setHintVisible(true)}>
                <Lightbulb />
                Show hint
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5 border-t bg-muted/20 pt-6">
        {flashcard ? (
          !revealed ? (
            <Button className="w-full" size="lg" onClick={session.reveal}>
              <Eye />
              Reveal answer
            </Button>
          ) : (
            result === null && (
              <div className="space-y-3" aria-live="polite">
                <p className="text-center text-sm text-muted-foreground">
                  Did you remember the missing word?
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" onClick={() => session.rateFlashcard(false)}>
                    <RotateCcw />
                    Need more practice
                  </Button>
                  <Button ref={ratingButton} size="lg" onClick={() => session.rateFlashcard(true)}>
                    <Check />I remembered
                  </Button>
                </div>
              </div>
            )
          )
        ) : choiceMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Answer choices">
              {session.choices.map((choice, index) => (
                <Button
                  key={choice.id}
                  variant="outline"
                  size="lg"
                  className={cn(
                    'h-auto min-h-14 justify-start gap-3 text-left text-base whitespace-normal disabled:opacity-100',
                    result !== null && choice.isCorrect && 'border-success bg-success/10 text-success',
                    result === false &&
                      session.answer === choice.label &&
                      'border-destructive bg-destructive/5 text-destructive'
                  )}
                  disabled={result !== null}
                  onClick={() => session.check(choice.label)}
                  aria-label={choice.label}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded border bg-background text-xs text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1">{choice.label}</span>
                  {result !== null && choice.isCorrect && <Check className="size-4" />}
                  {result === false && session.answer === choice.label && <X className="size-4" />}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {session.choices.length < 2
                ? 'This sentence has no other answer choices. Try typed answers or flashcards for a stronger challenge.'
                : `Press 1–${session.choices.length} to choose an answer, or select an option.`}
            </p>
          </div>
        ) : (
          <form
            id="typed-answer"
            onSubmit={event => {
              event.preventDefault()
              if (result === null) session.check()
              else session.next()
            }}
          >
            <Button
              ref={nextButton}
              type="submit"
              className="w-full"
              size="lg"
              disabled={result === null && !session.answer.trim()}
            >
              {result === null ? 'Check answer' : isLast ? 'Finish session' : 'Next sentence'}
              <ArrowRight />
            </Button>
          </form>
        )}
        {revealed && sentence.notes && (
          <Markdown className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {sentence.notes}
          </Markdown>
        )}
        {!typed && result !== null && (
          <Button ref={nextButton} className="w-full" size="lg" onClick={session.next}>
            {isLast ? 'Finish session' : 'Next sentence'}
            <ArrowRight />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
