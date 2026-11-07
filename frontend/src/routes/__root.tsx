import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { type ReactNode, Suspense, lazy } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { sessionQuery } from '@/data/session'
import appCss from '../styles.css?url'

const Devtools = import.meta.env.DEV ? lazy(() => import('@/components/devtools')) : () => null

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Resolve the session during SSR so the first paint already shows the right navigation.
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(sessionQuery)
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Clozera' },
      {
        name: 'description',
        content: 'Clozera is an open-source language learning app built around cloze-based practice.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/brand/favicon-light.ico', sizes: '16x16 32x32 48x48' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/brand/favicon-light-32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/brand/favicon-dark-32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" />
        <Suspense>
          <Devtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
