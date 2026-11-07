import { useEffect, useState } from 'react'

/** Seconds left before an action may run again, e.g. resending an email. */
export function useCooldown(seconds: number) {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until <= now) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until, now])

  return {
    remaining: Math.max(0, Math.ceil((until - now) / 1000)),
    start: () => {
      const current = Date.now()
      setNow(current)
      setUntil(current + seconds * 1000)
    },
  }
}
