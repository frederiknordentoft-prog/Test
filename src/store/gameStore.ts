import { create } from 'zustand'
import type { BallType, PieceType, PlacedPiece, RunResult, Stars } from '../types'
import type { FailReason, SimResult } from '../physics/simulate'
import { LEVELS, getLevel } from '../../data/levels'
import { isValidRotation, ROTATION_DOMAINS } from '../physics/constants'
import { canPlace, inventoryTypes, pieceInSlot, remaining } from '../game/inventory'
import { starsForRun, worldUnlocked } from '../game/progression'

export type View = 'levelSelect' | 'game'

/** The slice of state we persist to Dexie (schema v2). */
export type PersistedState = {
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  ballType: BallType
  muted: boolean
  tutorialSeen: boolean
  starsByLevel: Record<string, Stars>
}

export type GameStore = {
  view: View
  currentLevelId: string
  placements: PlacedPiece[]
  ballType: BallType
  runResult: RunResult
  runReason: FailReason | null
  /** Stars earned by the run that just finished (result panel count-up). */
  runStars: Stars
  activePieceType: PieceType | null
  /** Slot whose radial angle picker is open, if any. */
  openPickerSlot: string | null
  starsByLevel: Record<string, Stars>
  muted: boolean
  tutorialSeen: boolean
  /** True once Dexie has loaded (or confirmed empty) — gates the first save. */
  hydrated: boolean

  goToLevelSelect: () => void
  selectLevel: (id: string) => void

  setActivePieceType: (t: PieceType | null) => void
  setBallType: (b: BallType) => void
  tapSlot: (slotId: string) => void
  setRotation: (slotId: string, rotation: number) => void
  removeSlot: (slotId: string) => void
  clearPlacements: () => void
  closePicker: () => void

  dropBall: () => void
  finishRun: (sim: SimResult) => void
  resetRun: () => void
  resetProgress: () => void
  toggleMuted: () => void

  hydrate: (persisted: Partial<PersistedState>) => void
}

const firstLevelId = LEVELS[0]?.id ?? ''

/** The ball to use for a level: keep the player's choice if the level allows it. */
function ballFor(levelId: string, preferred: BallType): BallType {
  const level = getLevel(levelId)
  if (!level) return preferred
  return level.balls.includes(preferred) ? preferred : (level.balls[0] as BallType)
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Apply an edit to placements; any edit invalidates a finished run. */
  const edit = (mutate: (placements: PlacedPiece[]) => PlacedPiece[]) => {
    const { runResult, placements } = get()
    if (runResult === 'running') return // never edit mid-flight
    set({
      placements: mutate(placements),
      runResult: 'idle',
      runReason: null,
      runStars: 0,
    })
  }

  return {
    view: 'levelSelect',
    currentLevelId: firstLevelId,
    placements: [],
    ballType: 'iron',
    runResult: 'idle',
    runReason: null,
    runStars: 0,
    activePieceType: null,
    openPickerSlot: null,
    starsByLevel: {},
    muted: false,
    tutorialSeen: false,
    hydrated: false,

    goToLevelSelect: () =>
      set({ view: 'levelSelect', runResult: 'idle', runReason: null, runStars: 0, openPickerSlot: null }),

    selectLevel: (id) => {
      const level = getLevel(id)
      if (!level) return
      if (!worldUnlocked(level.world, get().starsByLevel)) return
      const { currentLevelId, placements, ballType } = get()
      // Keep placements only when re-opening the very same level (restore flow);
      // switching to a different level starts fresh.
      const keep = id === currentLevelId
      set({
        view: 'game',
        currentLevelId: id,
        placements: keep ? placements : [],
        ballType: ballFor(id, ballType),
        runResult: 'idle',
        runReason: null,
        runStars: 0,
        openPickerSlot: null,
        activePieceType: inventoryTypes(level)[0] ?? null,
      })
    },

    setActivePieceType: (t) => set({ activePieceType: t, openPickerSlot: null }),

    setBallType: (b) => {
      // Changing the ball changes the outcome, so it invalidates a finished run.
      const { runResult, currentLevelId } = get()
      if (runResult === 'running') return
      const level = getLevel(currentLevelId)
      if (level && !level.balls.includes(b)) return
      set({ ballType: b, runResult: 'idle', runReason: null, runStars: 0 })
    },

    tapSlot: (slotId) => {
      const { currentLevelId, placements, activePieceType, runResult, openPickerSlot } = get()
      if (runResult === 'running') return
      const level = getLevel(currentLevelId)
      if (!level) return
      const slot = level.slots.find((s) => s.id === slotId)
      if (!slot) return

      const existing = pieceInSlot(placements, slotId)
      if (existing) {
        // Tapping a filled slot toggles its radial angle picker.
        set({ openPickerSlot: openPickerSlot === slotId ? null : slotId })
        return
      }
      // Empty slot: place the active piece type at its default rotation.
      if (!activePieceType) return
      if (!canPlace(level, placements, slot, activePieceType)) return
      const rotation = ROTATION_DOMAINS[activePieceType][0] as number
      const next = [...placements, { slotId, type: activePieceType, rotation }]
      // If that was the last of this type, advance the palette to the next
      // type the player still has, so the next tap isn't a silent no-op.
      const nextActive =
        remaining(level, next, activePieceType) > 0
          ? activePieceType
          : inventoryTypes(level).find((t) => remaining(level, next, t) > 0) ?? activePieceType
      set({
        placements: next,
        activePieceType: nextActive,
        runResult: 'idle',
        runReason: null,
        runStars: 0,
        // Open the picker right away when the piece has angles to choose from.
        openPickerSlot: ROTATION_DOMAINS[activePieceType].length > 1 ? slotId : null,
      })
    },

    setRotation: (slotId, rotation) => {
      const { placements } = get()
      const piece = pieceInSlot(placements, slotId)
      if (!piece || !isValidRotation(piece.type, rotation)) return
      edit((ps) => ps.map((p) => (p.slotId === slotId ? { ...p, rotation } : p)))
      set({ openPickerSlot: null })
    },

    removeSlot: (slotId) => {
      edit((ps) => ps.filter((p) => p.slotId !== slotId))
      set({ openPickerSlot: null })
    },

    clearPlacements: () => {
      edit(() => [])
      set({ openPickerSlot: null })
    },

    closePicker: () => set({ openPickerSlot: null }),

    dropBall: () => {
      const { runResult } = get()
      if (runResult === 'running') return
      set({ runResult: 'running', runReason: null, runStars: 0, openPickerSlot: null })
    },

    finishRun: (sim) => {
      const { currentLevelId, placements, starsByLevel, tutorialSeen } = get()
      const level = getLevel(currentLevelId)
      if (!level) return
      const stars = starsForRun(level, sim, placements.length)
      const best = starsByLevel[currentLevelId] ?? 0
      set({
        runResult: sim.result === 'won' ? 'won' : 'failed',
        runReason: sim.reason,
        runStars: stars,
        starsByLevel: stars > best ? { ...starsByLevel, [currentLevelId]: stars } : starsByLevel,
        // The tutorial has served its purpose once the first level is beaten.
        tutorialSeen: tutorialSeen || (sim.result === 'won' && currentLevelId === firstLevelId),
      })
    },

    resetRun: () => set({ runResult: 'idle', runReason: null, runStars: 0 }),

    resetProgress: () =>
      set({
        starsByLevel: {},
        placements: [],
        runResult: 'idle',
        runReason: null,
        runStars: 0,
        tutorialSeen: false,
        currentLevelId: firstLevelId,
      }),

    toggleMuted: () => set((s) => ({ muted: !s.muted })),

    hydrate: (persisted) =>
      set((state) => {
        const validLevel = !!persisted.currentLevelId && !!getLevel(persisted.currentLevelId)
        const nextLevelId = validLevel ? persisted.currentLevelId! : state.currentLevelId
        const level = getLevel(nextLevelId)
        const starsByLevel: Record<string, Stars> = {}
        for (const [id, s] of Object.entries(persisted.starsByLevel ?? {})) {
          if (getLevel(id) && typeof s === 'number' && s >= 0 && s <= 3) starsByLevel[id] = s as Stars
        }
        return {
          view: persisted.view === 'game' && validLevel ? 'game' : state.view,
          currentLevelId: nextLevelId,
          placements: persisted.placements ?? state.placements,
          ballType: ballFor(nextLevelId, persisted.ballType ?? state.ballType),
          starsByLevel,
          muted: persisted.muted ?? state.muted,
          tutorialSeen: persisted.tutorialSeen ?? state.tutorialSeen,
          activePieceType: level ? inventoryTypes(level)[0] ?? null : state.activePieceType,
          hydrated: true,
        }
      }),
  }
})
