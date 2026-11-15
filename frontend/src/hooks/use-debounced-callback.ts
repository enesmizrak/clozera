import { useEffect, useMemo, useRef } from 'react'

/** Returns `run`, which calls `callback` once input pauses for `delay` ms, and `cancel` for the pending call. */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay: number) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return useMemo(() => {
    const run = (...args: A) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => latest.current(...args), delay)
    }
    const cancel = () => clearTimeout(timer.current)
    return { run, cancel }
  }, [delay])
}
