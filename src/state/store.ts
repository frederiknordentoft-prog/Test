import { create } from 'zustand'
import {
  playBalance,
  playClink,
  playRemove,
  playVictory,
  setMuted,
  vibrate,
} from '../audio/sound'
import { ELEMENT_BY_SYMBOL, MICRO, formatU } from '../data/elements'
import { moleculeBreakdown } from '../data/molecules'
import { engine } from '../engine/instance'
import {
  challengeTargetMicro,
  generateChallenge,
  TOLERANCE_U,
} from '../game/challenge'
import {
  applySkip,
  applyVictory,
  emptyProgress,
  type Progress,
} from '../game/scoring'
import { solveFewest } from '../game/solver'
import type { BeamState, Challenge, Mode, PanSide, Tile } from '../game/types'
import { tileMass } from '../game/types'
import { loadProgress, saveProgress } from './db'

export type ReducedMotionSetting = 'auto' | 'reduceret'
export type Settings = { sound: boolean; reducedMotion: ReducedMotionSetting }

export type VictoryInfo = {
  mode: Mode
  tilesUsed: number
  optimal: number | null
  breakdown: string | null
}

const SETTINGS_KEY = 'vaegtskaalen-settings'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { sound: true, reducedMotion: 'auto', ...JSON.parse(raw) }
  } catch {
    // ignorér
  }
  return { sound: true, reducedMotion: 'auto' }
}

function persistSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // ignorér
  }
}

let playerTileCounter = 0

const REST_BEAM: BeamState = {
  angle: 0,
  angularVel: 0,
  leftMass: 0,
  rightMass: 0,
  settled: true,
  balanced: false,
}

type GameStore = {
  mode: Mode
  fewest: boolean
  challenge: Challenge
  left: Tile[]
  right: Tile[]
  activeSide: PanSide
  beam: BeamState
  victory: VictoryInfo | null
  solved: boolean
  wrongMoleculeHint: boolean
  progress: Progress
  settings: Settings

  init: () => void
  setMode: (mode: Mode) => void
  setFewest: (fewest: boolean) => void
  newChallenge: (opts?: { skipPenalty?: boolean }) => void
  addElement: (symbol: string, side?: PanSide) => void
  removeTile: (side: PanSide, id: string) => void
  setActiveSide: (side: PanSide) => void
  handleBeamState: (bs: BeamState) => void
  handleCelebrate: () => void
  handleTileLanded: (tile: Tile) => void
  dismissVictory: () => void
  toggleSound: () => void
  toggleReducedMotion: () => void
}

export function playerSideOf(challenge: Challenge): PanSide {
  return challenge.fixedSideOf === 'left' ? 'right' : 'left'
}

function playerTiles(state: { challenge: Challenge; left: Tile[]; right: Tile[] }): Tile[] {
  return playerSideOf(state.challenge) === 'right' ? state.right : state.left
}

/** Har spilleren lagt præcis molekylets atomer (eksakt multiset)? */
function hasExactAtoms(tiles: readonly Tile[], atoms: Record<string, number>): boolean {
  const counts = new Map<string, number>()
  for (const t of tiles) {
    if (t.kind !== 'element') return false
    counts.set(t.element.symbol, (counts.get(t.element.symbol) ?? 0) + 1)
  }
  const wanted = Object.entries(atoms)
  if (counts.size !== wanted.length) return false
  return wanted.every(([s, n]) => counts.get(s) === n)
}

/** Kør en frisk challenge ind i engine (reset + fixed tiles + tolerance). */
function pushChallengeToEngine(challenge: Challenge, left: Tile[], right: Tile[]): void {
  engine.reset()
  engine.setTolerance(Math.round(challenge.toleranceU * MICRO))
  if (challenge.mode === 'ram') {
    const targetMicro = challengeTargetMicro(challenge)
    engine.setVirtualLeft(targetMicro, `${formatU(targetMicro, 3)} u`)
  }
  engine.syncPans(left, right)
}

const initial = generateChallenge('fri', 1)

export const useGameStore = create<GameStore>((set, get) => ({
  mode: 'fri',
  fewest: false,
  challenge: initial.challenge,
  left: [],
  right: [],
  activeSide: 'left',
  beam: REST_BEAM,
  victory: null,
  solved: false,
  wrongMoleculeHint: false,
  progress: emptyProgress(),
  settings: loadSettings(),

  init: () => {
    const settings = loadSettings()
    setMuted(!settings.sound)
    set({ settings })
    void loadProgress().then((progress) => set({ progress }))
    get().newChallenge({ skipPenalty: false })
  },

  setMode: (mode) => {
    // Mode-skift straffer ikke streaken — kun eksplicit "Ny udfordring" gør.
    set({ mode })
    get().newChallenge({ skipPenalty: false })
  },

  setFewest: (fewest) => {
    set({ fewest })
    get().newChallenge({ skipPenalty: false })
  },

  newChallenge: (opts = {}) => {
    const s = get()
    const skipPenalty = opts.skipPenalty ?? true
    if (skipPenalty && !s.solved && s.mode !== 'fri' && playerTiles(s).length > 0) {
      const progress = applySkip(s.progress)
      set({ progress })
      void saveProgress(progress)
    }

    const seed = (Math.random() * 2 ** 31) | 0
    const gen = generateChallenge(s.mode, seed, { fewest: s.fewest })
    const left = gen.challenge.fixedSideOf === 'left' ? [...gen.challenge.fixedSide] : []
    const right = gen.challenge.fixedSideOf === 'right' ? [...gen.challenge.fixedSide] : []

    pushChallengeToEngine(gen.challenge, left, right)
    set({
      challenge: gen.challenge,
      left,
      right,
      beam: REST_BEAM,
      victory: null,
      solved: false,
      wrongMoleculeHint: false,
      activeSide: s.mode === 'fri' ? s.activeSide : playerSideOf(gen.challenge),
    })
  },

  addElement: (symbol, side) => {
    const s = get()
    const el = ELEMENT_BY_SYMBOL.get(symbol)
    if (!el) return
    const target =
      side ?? (s.mode === 'fri' ? s.activeSide : playerSideOf(s.challenge))
    if (s.mode !== 'fri' && target !== playerSideOf(s.challenge)) return

    const tile: Tile = {
      id: `p-${symbol}-${playerTileCounter++}`,
      kind: 'element',
      element: el,
    }
    const left = target === 'left' ? [...s.left, tile] : s.left
    const right = target === 'right' ? [...s.right, tile] : s.right
    engine.syncPans(left, right)
    set({ left, right, wrongMoleculeHint: false })
  },

  removeTile: (side, id) => {
    if (id.startsWith('fixed-')) return // låst challenge-side
    const s = get()
    const left = side === 'left' ? s.left.filter((t) => t.id !== id) : s.left
    const right = side === 'right' ? s.right.filter((t) => t.id !== id) : s.right
    if (left === s.left && right === s.right) return
    engine.syncPans(left, right)
    playRemove()
    set({ left, right, wrongMoleculeHint: false })
  },

  setActiveSide: (side) => set({ activeSide: side }),

  handleBeamState: (bs) => set({ beam: bs }),

  handleCelebrate: () => {
    const s = get()
    const player = playerTiles(s)
    const exactMolecule =
      s.mode !== 'molekyle' ||
      (s.challenge.molecule !== undefined &&
        hasExactAtoms(player, s.challenge.molecule.atoms))

    const isVictory =
      s.mode !== 'fri' && !s.solved && player.length > 0 && exactMolecule

    if (isVictory) {
      const tilesUsed = player.length
      let optimal: number | null = null
      if (s.challenge.fewestMode) {
        const targetMicro = challengeTargetMicro(s.challenge)
        optimal =
          solveFewest(targetMicro, Math.round(TOLERANCE_U * MICRO))?.length ?? null
      }
      const progress = applyVictory(s.progress, s.mode, tilesUsed, s.challenge.fewestMode ?? false)
      void saveProgress(progress)
      playVictory()
      vibrate([30, 40, 80])
      set({
        solved: true,
        progress,
        victory: {
          mode: s.mode,
          tilesUsed,
          optimal,
          breakdown: s.challenge.molecule ? moleculeBreakdown(s.challenge.molecule) : null,
        },
      })
      return
    }

    // Balance uden sejr: fri leg, allerede løst, eller forkerte atomer i molekyle-mode
    playBalance()
    vibrate([20, 30, 40])
    if (s.mode === 'molekyle' && !s.solved && player.length > 0 && !exactMolecule) {
      set({ wrongMoleculeHint: true })
    }
  },

  handleTileLanded: (tile) => {
    playClink(tileMass(tile))
    vibrate(8)
  },

  dismissVictory: () => set({ victory: null }),

  toggleSound: () => {
    const settings = { ...get().settings, sound: !get().settings.sound }
    setMuted(!settings.sound)
    persistSettings(settings)
    set({ settings })
  },

  toggleReducedMotion: () => {
    const current = get().settings.reducedMotion
    const settings: Settings = {
      ...get().settings,
      reducedMotion: current === 'auto' ? 'reduceret' : 'auto',
    }
    persistSettings(settings)
    set({ settings })
  },
}))

/** Effektiv reduced motion: brugervalg 'reduceret' ELLER OS-præference. */
export function effectiveReducedMotion(settings: Settings): boolean {
  if (settings.reducedMotion === 'reduceret') return true
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
