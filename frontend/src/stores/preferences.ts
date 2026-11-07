import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_SESSION_LIMIT, PRACTICE_MODES, type PracticeMode } from '@/lib/practice-session'

export type CollectionSort = 'name' | 'sentences'

interface PreferencesState {
  collectionSort: CollectionSort
  expandedGroupIds: string[]
  practiceMode: PracticeMode
  practiceLimit: number
  setCollectionSort: (sort: CollectionSort) => void
  setExpandedGroupIds: (ids: string[]) => void
  setPracticeDefaults: (mode: PracticeMode, limit: number) => void
}

/**
 * Per-device UI preferences. Server data lives in TanStack Query/DB and navigational
 * state lives in the URL; Zustand only remembers how the learner likes to browse and practice.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    set => ({
      collectionSort: 'name',
      expandedGroupIds: [],
      practiceMode: PRACTICE_MODES.typed,
      practiceLimit: DEFAULT_SESSION_LIMIT,
      setCollectionSort: collectionSort => set({ collectionSort }),
      setExpandedGroupIds: expandedGroupIds => set({ expandedGroupIds }),
      setPracticeDefaults: (practiceMode, practiceLimit) => set({ practiceMode, practiceLimit }),
    }),
    {
      name: 'clozera.preferences',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    }
  )
)
