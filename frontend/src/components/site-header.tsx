import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { resetLearnerData } from '@/data/collections'
import { languagePairsQuery } from '@/data/languages'
import { sessionQuery, useSessionUser } from '@/data/session'
import { api, errorMessage } from '@/lib/api'
import { authClient } from '@/lib/auth-client'

function Wordmark({ to }: { to: '/' | '/dashboard' }) {
  return (
    <Link
      to={to}
      aria-label={to === '/' ? 'Clozera home' : 'Clozera dashboard'}
      className="shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
    >
      <img
        src="/brand/clozera-wordmark.png"
        alt="Clozera"
        width={480}
        height={160}
        className="block h-10 w-30 object-contain"
      />
    </Link>
  )
}

/** Header for public pages: sign-in links, or a way back into the app. */
export function PublicHeader() {
  const user = useSessionUser()
  return (
    <header className="border-b bg-card/80">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-4"
      >
        <Wordmark to="/" />
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard" className={buttonVariants()}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
                Log in
              </Link>
              <Link to="/sign-up" className={buttonVariants()}>
                Start practicing
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

/** Header for signed-in pages: language pair switcher and account menu. */
export function AppHeader() {
  const user = useSessionUser()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: allPairs = [] } = useQuery(languagePairsQuery)
  const [accountOpen, setAccountOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (!user) return null
  const learnerPairs = allPairs.filter(pair => user.languagePairs.some(own => own.slug === pair.slug))
  const pairs = learnerPairs.length ? learnerPairs : user.languagePairs
  const pairItems = pairs.map(pair => ({ value: pair.slug, label: pair.name }))

  async function switchLanguagePair(slug: string | null) {
    if (!slug || slug === user?.selectedLanguagePair?.slug) return
    setSwitching(true)
    try {
      queryClient.setQueryData(
        sessionQuery.queryKey,
        await api.updateProfile({ selectedLanguagePairSlug: slug })
      )
      await router.invalidate()
      await router.navigate({ to: '/dashboard' })
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to switch language. Please try again.'))
    } finally {
      setSwitching(false)
    }
  }

  async function signOut() {
    const { error } = await authClient.signOut()
    if (error) {
      toast.error('Unable to end your session. Please try again.')
      return
    }
    // Leave the app first so no live query still reads the collections being dropped.
    queryClient.setQueryData(sessionQuery.queryKey, null)
    await router.navigate({ to: '/' })
    await resetLearnerData()
    await router.invalidate()
  }

  return (
    <header className="border-b bg-card/80">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-4"
      >
        <Wordmark to="/dashboard" />
        <div className="flex items-center gap-2">
          {pairItems.length > 0 && (
            <Select
              items={pairItems}
              value={user.selectedLanguagePair?.slug ?? null}
              onValueChange={value => void switchLanguagePair(value)}
              disabled={switching}
            >
              <SelectTrigger aria-label="Language pair" className="max-w-40 sm:max-w-56">
                <SelectValue placeholder="Language pair" />
              </SelectTrigger>
              <SelectContent>
                {pairItems.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Account" />}>
              <User />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAccountOpen(true)}>Account info</DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/languages" />}>Add language pair</DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/settings" />}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account info</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="col-span-2">{user.name}</dd>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="col-span-2">@{user.username}</dd>
            <dt className="text-muted-foreground">Language pair</dt>
            <dd className="col-span-2">
              {user.selectedLanguagePair?.name ?? 'No language pair selected yet.'}
            </dd>
          </dl>
        </DialogContent>
      </Dialog>
    </header>
  )
}
