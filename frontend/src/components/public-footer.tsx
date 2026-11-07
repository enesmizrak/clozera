import { buttonVariants } from '@/components/ui/button'

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t bg-card/80 px-5 py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>© 2026 Clozera · Open-source language learning</p>
        <nav aria-label="Footer" className="flex gap-1">
          <a className={buttonVariants({ variant: 'link', size: 'sm' })} href="mailto:info@clozera.app">
            Contact
          </a>
          <a className={buttonVariants({ variant: 'link', size: 'sm' })} href="/terms">
            Terms
          </a>
          <a className={buttonVariants({ variant: 'link', size: 'sm' })} href="/privacy">
            Privacy
          </a>
        </nav>
      </div>
    </footer>
  )
}
