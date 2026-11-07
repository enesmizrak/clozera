import { Markdown as MarkdownRenderer, type MarkdownComponents } from '@tanstack/markdown/react'
import { cn } from '@/lib/utils'

const components = {
  a({ children, ...props }) {
    return (
      <a {...props} rel="nofollow noopener noreferrer" target="_blank">
        {children}
      </a>
    )
  },
} satisfies MarkdownComponents

/**
 * Renders learner-authored Markdown (descriptions, sentence notes). Raw HTML is disabled
 * because community collections show text written by other learners.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-notes', className)}>
      <MarkdownRenderer allowHtml={false} components={components}>
        {children}
      </MarkdownRenderer>
    </div>
  )
}
