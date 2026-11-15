import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { Markdown } from './markdown'

describe('Markdown', () => {
  it('does not render remote images and shows the alt text instead', () => {
    const { container } = render(<Markdown>{'![tracker](https://example.com/p.gif)'}</Markdown>)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('tracker')).toBeTruthy()
  })

  it('opens external links in a new tab', () => {
    render(<Markdown>{'[x](https://example.com)'}</Markdown>)

    expect(screen.getByRole('link', { name: 'x' }).getAttribute('target')).toBe('_blank')
  })

  it('keeps in-page anchors in the same tab', () => {
    render(<Markdown>{'[jump](#section)'}</Markdown>)

    expect(screen.getByRole('link', { name: 'jump' }).hasAttribute('target')).toBe(false)
  })

  it('does not render raw script tags', () => {
    const { container } = render(<Markdown>{'<script>alert(1)</script>'}</Markdown>)

    expect(container.querySelector('script')).toBeNull()
  })
})
