import type { ReactNode } from 'react'
import { PublicFooter } from '@/components/public-footer'
import { PublicHeader } from '@/components/site-header'

/** Narrow centered layout for sign-in and account pages. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">{children}</main>
      <PublicFooter />
    </div>
  )
}
