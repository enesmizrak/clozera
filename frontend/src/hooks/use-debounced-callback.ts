import { useEffect, useMemo, useRef } from 'react'

/** Returns a function that calls `callback` once input pauses for `delay` ms. */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay: number) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return useMemo(
    () =>
      (...args: A) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => latest.current(...args), delay)
      },
    [delay]
  )
}
