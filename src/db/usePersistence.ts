import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { loadProgress, saveProgress } from './db'

/**
 * Loads persisted progress once on mount, then keeps Dexie in sync with the
 * store. Only the persisted slice (view, level, placements, completed) triggers
 * a save; transient run state does not. This is what lets a mid-level reload
 * restore the current level and its placements.
 */
export function usePersistence(): void {
  const hydrate = useGameStore((s) => s.hydrate)

  useEffect(() => {
    let active = true
    loadProgress()
      .then((row) => {
        if (!active) return
        hydrate(row ?? {})
      })
      .catch(() => {
        if (active) hydrate({})
      })
    return () => {
      active = false
    }
  }, [hydrate])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useGameStore.subscribe((state) => {
      if (!state.hydrated) return
      if (timer) clearTimeout(timer)
      // Debounce so rapid edits don't thrash IndexedDB.
      timer = setTimeout(() => {
        void saveProgress({
          view: state.view,
          currentLevelId: state.currentLevelId,
          placements: state.placements,
          ballType: state.ballType,
          muted: state.muted,
          tutorialSeen: state.tutorialSeen,
          starsByLevel: state.starsByLevel,
        })
      }, 150)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [])
}
