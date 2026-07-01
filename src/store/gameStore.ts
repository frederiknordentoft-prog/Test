import { create } from 'zustand'
import type { PieceType, PlacedPiece, RunResult } from '../types'
import type { FailReason } from '../physics/simulate'
import { LEVELS, getLevel } from '../../data/levels'
import { ROTATION_STEPS } from '../physics/constants'
import { canPlace, inventoryTypes, pieceInSlot } from '../game/inventory'

export type View = 'levelSelect' | 'game'

/** The slice of state we persist to Dexie. */
export type PersistedState = {
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  completedLevels: string[]
}

export type GameStore = {
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  runResult: RunResult
  runReason: FailReason | null
  activePieceType: PieceType | null
  completedLevels: string[]
  /** True once Dexie has loaded (or confirmed empty) — gates the first save. */
  hydrated: boolean

  goToLevelSelect: () => void
  selectLevel: (id: string) => void

  setActivePieceType: (t: PieceType | null) => void
  tapSlot: (slotId: string) => void
  rotateSlot: (slotId: string) => void
  removeSlot: (slotId: string) => void
  clearPlacements: () => void

  dropBall: () => void
  finishRun: (result: 'won' | 'failed', reason: FailReason) => void
  resetRun: () => void

  hydrate: (persisted: Partial<PersistedState>) => void
}

const firstLevelId = LEVELS[0]?.id ?? ''

export const useGameStore = create<GameStore>((set, get) => {
  /** Apply an edit to placements; any edit invalidates a finished run. */
  const edit = (mutate: (placements: PlacedPiece[]) => PlacedPiece[]) => {
    const { runResult, placements } = get()
    if (runResult === 'running') return // never edit mid-flight
    set({
      placements: mutate(placements),
      runResult: 'idle',
      runReason: null,
    })
  }

  return {
    view: 'levelSelect',
    currentLevelId: firstLevelId,
    placements: [],
    runResult: 'idle',
    runReason: null,
    activePieceType: null,
    completedLevels: [],
    hydrated: false,

    goToLevelSelect: () => set({ view: 'levelSelect', runResult: 'idle', runReason: null }),

    selectLevel: (id) => {
      const level = getLevel(id)
      if (!level) return
      const { currentLevelId, placements } = get()
      // Keep placements only when re-opening the very same level (restore flow);
      // switching to a different level starts fresh.
      const keep = id === currentLevelId
      set({
        view: 'game',
        currentLevelId: id,
        placements: keep ? placements : [],
        runResult: 'idle',
        runReason: null,
        activePieceType: inventoryTypes(level)[0] ?? null,
      })
    },

    setActivePieceType: (t) => set({ activePieceType: t }),

    tapSlot: (slotId) => {
      const { currentLevelId, placements, activePieceType, runResult } = get()
      if (runResult === 'running') return
      const level = getLevel(currentLevelId)
      if (!level) return
      const slot = level.slots.find((s) => s.id === slotId)
      if (!slot) return

      const existing = pieceInSlot(placements, slotId)
      if (existing) {
        // Tapping a filled slot rotates its piece.
        get().rotateSlot(slotId)
        return
      }
      // Empty slot: place the active piece type if allowed and available.
      if (!activePieceType) return
      if (!canPlace(level, placements, slot, activePieceType)) return
      edit((ps) => [...ps, { slotId, type: activePieceType, rotation: 0 }])
    },

    rotateSlot: (slotId) => {
      edit((ps) =>
        ps.map((p) =>
          p.slotId === slotId ? { ...p, rotation: (p.rotation + 1) % ROTATION_STEPS.length } : p,
        ),
      )
    },

    removeSlot: (slotId) => {
      edit((ps) => ps.filter((p) => p.slotId !== slotId))
    },

    clearPlacements: () => edit(() => []),

    dropBall: () => {
      const { runResult } = get()
      if (runResult === 'running') return
      set({ runResult: 'running', runReason: null })
    },

    finishRun: (result, reason) => {
      const { currentLevelId, completedLevels } = get()
      const completed =
        result === 'won' && !completedLevels.includes(currentLevelId)
          ? [...completedLevels, currentLevelId]
          : completedLevels
      set({ runResult: result, runReason: reason, completedLevels: completed })
    },

    resetRun: () => set({ runResult: 'idle', runReason: null }),

    hydrate: (persisted) =>
      set((state) => {
        const validLevel = !!persisted.currentLevelId && !!getLevel(persisted.currentLevelId)
        const nextLevelId = validLevel ? persisted.currentLevelId! : state.currentLevelId
        const level = getLevel(nextLevelId)
        return {
          view: persisted.view === 'game' && validLevel ? 'game' : state.view,
          currentLevelId: nextLevelId,
          placements: persisted.placements ?? state.placements,
          completedLevels: persisted.completedLevels ?? state.completedLevels,
          activePieceType: level ? inventoryTypes(level)[0] ?? null : state.activePieceType,
          hydrated: true,
        }
      }),
  }
})
