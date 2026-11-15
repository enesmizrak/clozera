import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { useDebouncedCallback } from './use-debounced-callback'

describe('useDebouncedCallback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs once with the last arguments after input pauses', () => {
    vi.useFakeTimers()
    const callback = vi.fn<(value: string) => void>()
    const { result } = renderHook(() => useDebouncedCallback(callback, 200))

    result.current.run('a')
    vi.advanceTimersByTime(50)
    result.current.run('ab')
    vi.advanceTimersByTime(50)
    result.current.run('abc')
    vi.advanceTimersByTime(199)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('abc')
  })

  it('drops the pending call when cancelled', () => {
    vi.useFakeTimers()
    const callback = vi.fn<(value: string) => void>()
    const { result } = renderHook(() => useDebouncedCallback(callback, 200))

    result.current.run('a')
    result.current.cancel()
    vi.advanceTimersByTime(200)

    expect(callback).not.toHaveBeenCalled()
  })
})
