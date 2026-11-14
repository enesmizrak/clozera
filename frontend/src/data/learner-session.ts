type Listener = () => void
const listeners = new Set<Listener>()

/** Called by the API client when a request answers 401: the server no longer knows this learner. */
export function notifySessionLost(): void {
  for (const listener of listeners) listener()
}

export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let ending: Promise<void> | null = null

/** Leaves the signed-in app, then drops learner data. Concurrent calls share one run. */
export function endLearnerSession(steps: {
  clearSession: () => void
  navigate: () => Promise<void>
  reset: () => Promise<void>
  invalidate: () => Promise<void>
}): Promise<void> {
  ending ??= (async () => {
    steps.clearSession()
    await steps.navigate()
    await steps.reset()
    await steps.invalidate()
  })().finally(() => {
    ending = null
  })
  return ending
}
