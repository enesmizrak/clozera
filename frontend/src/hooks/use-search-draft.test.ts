import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useSearchDraft } from './use-search-draft'

describe('useSearchDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setup(initial = '') {
    const write = vi.fn<(value: string) => void>()
    const hook = renderHook(({ query }) => useSearchDraft(query, write, 200), {
      initialProps: { query: initial },
    })
    return { write, ...hook }
  }

  it('keeps in-progress typing when an earlier write lands', () => {
    const { result, rerender, write } = setup()
    act(() => result.current.onType('ab'))
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(write).toHaveBeenCalledWith('ab')
    act(() => result.current.onType('abc'))
    rerender({ query: 'ab' })
    expect(result.current.draft).toBe('abc')
  })

  it('adopts a change that came from outside', () => {
    const { result, rerender } = setup()
    rerender({ query: 'zz' })
    expect(result.current.draft).toBe('zz')
  })

  it('clearing writes immediately and drops the pending write', () => {
    const { result, write } = setup()
    act(() => result.current.onType('x'))
    act(() => result.current.clear())
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(write.mock.calls).toEqual([['']])
    expect(result.current.draft).toBe('')
  })

  it('follows Back to an empty query after clearing', () => {
    const { result, rerender } = setup()
    act(() => result.current.onType('x'))
    act(() => result.current.clear())
    rerender({ query: 'cefr' })
    expect(result.current.draft).toBe('cefr')
    rerender({ query: '' })
    expect(result.current.draft).toBe('')
  })
})
