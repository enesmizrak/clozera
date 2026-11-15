import { useState } from 'react'
import { useDebouncedCallback } from './use-debounced-callback'

/**
 * Keeps a text input responsive while the URL catches up: `draft` follows every keystroke, `write`
 * receives the value once typing pauses. Changes that come from outside (e.g. Back) replace the draft.
 */
export function useSearchDraft(query: string, write: (value: string) => void, delay = 200) {
  const [draft, setDraft] = useState(query)
  const [prevQuery, setPrevQuery] = useState(query)
  // A write of ours that has not landed in `query` yet; null when nothing is in flight.
  const [lastWritten, setLastWritten] = useState<string | null>(null)

  if (query !== prevQuery) {
    setPrevQuery(query)
    if (query !== lastWritten) setDraft(query)
    setLastWritten(null)
  }

  const commit = (value: string) => {
    setLastWritten(value)
    write(value)
  }
  const debounced = useDebouncedCallback(commit, delay)

  return {
    draft,
    onType: (value: string) => {
      setDraft(value)
      debounced.run(value)
    },
    clear: () => {
      debounced.cancel()
      setDraft('')
      commit('')
    },
  }
}
