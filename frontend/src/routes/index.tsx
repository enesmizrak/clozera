import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Play } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'
import { PublicHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { homePathFor, useSessionUser } from '@/data/session'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const previewChoices = ['Kaffee', 'Tee', 'Wasser', 'Milch']

function HomePage() {
  const user = useSessionUser()
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-16 lg:grid-cols-2">
        <section className="space-y-6">
          <Badge variant="secondary">Cloze practice for language learners</Badge>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight md:text-5xl lg:text-6xl">
            Practice languages one missing word at a time.
          </h1>
          <p className="text-lg text-muted-foreground">
            Clozera turns sentence collections into quick recall sessions. Fill the missing word, check
            yourself, and keep the full context in view.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={user ? homePathFor(user) : '/sign-up'} className={buttonVariants({ size: 'lg' })}>
              <Play />
              Start practicing
            </Link>
            <Link
              to={user ? '/dashboard' : '/login'}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              {user ? 'Open dashboard' : 'Log in'}
              <ArrowRight />
            </Link>
          </div>
        </section>
        <Card aria-label="Practice preview" className="shadow-xl shadow-primary/5">
          <CardHeader>
            <CardDescription>Practice preview</CardDescription>
            <CardTitle>German Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-7">
            <Progress value={20} aria-label="Example progress" />
            <p className="text-sm text-muted-foreground">Sentence 3 / 10</p>
            <p className="text-3xl font-semibold">
              Ich trinke jeden Morgen{' '}
              <span className="cloze-blank">
                <span className="sr-only">missing word</span>
              </span>
              .
            </p>
            <p className="text-muted-foreground">I drink coffee every morning.</p>
            <div className="grid grid-cols-2 gap-3">
              {previewChoices.map(word => (
                <span key={word} className="rounded-md border py-3 text-center text-base">
                  {word}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
      <PublicFooter />
    </div>
  )
}
