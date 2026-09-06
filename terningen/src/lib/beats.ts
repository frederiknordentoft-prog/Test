import type { ComponentId } from '../content/model'

export type Stage = 'assembled' | 'exploded'

/**
 * Den scriptede fortælling:
 *   0 = samlet, 1 = eksploderet, 2..7 = de seks sider (beat = øjne + 1),
 *   8 = kernen (Arbejdsgange) som finale.
 * Rækkefølgen matcher specifikationens tabel og deep-link-eksempel
 * (`#beat=4&open=teknologi` — teknologi har 3 øjne).
 */
export const BEAT_ORDER: readonly ComponentId[] = [
  'kunde',
  'mennesker',
  'teknologi',
  'buildbuyown',
  'governance',
  'maaling',
  'arbejdsgange',
]

export const FIRST_BEAT = 0
export const LAST_BEAT = 1 + BEAT_ORDER.length // 8
export const BEAT_COUNT = LAST_BEAT + 1 // 9

export function isValidBeat(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= FIRST_BEAT && n <= LAST_BEAT
}

export function clampBeat(n: number): number {
  if (!Number.isFinite(n)) return FIRST_BEAT
  return Math.min(LAST_BEAT, Math.max(FIRST_BEAT, Math.round(n)))
}

export function nextBeat(n: number): number {
  return clampBeat(clampBeat(n) + 1)
}

export function prevBeat(n: number): number {
  return clampBeat(clampBeat(n) - 1)
}

export function beatForComponent(id: ComponentId): number {
  const i = BEAT_ORDER.indexOf(id)
  if (i < 0) throw new Error(`Ukendt komponent i fortællingen: ${id}`)
  return 2 + i
}

export function componentForBeat(beat: number): ComponentId | null {
  const b = clampBeat(beat)
  if (b < 2) return null
  return BEAT_ORDER[b - 2] ?? null
}

export function stageForBeat(beat: number): Stage {
  return clampBeat(beat) === 0 ? 'assembled' : 'exploded'
}

export type BeatState = { beat: number; stage: Stage; openComponent: ComponentId | null }

/** Udleder den fulde beat-tilstand fra et beat-nummer. */
export function resolveBeat(beat: number): BeatState {
  const b = clampBeat(beat)
  return { beat: b, stage: stageForBeat(b), openComponent: componentForBeat(b) }
}

/** Det modsatte: hvilket beat svarer til (stage, openComponent). */
export function beatForState(stage: Stage, openComponent: ComponentId | null): number {
  if (openComponent) return beatForComponent(openComponent)
  return stage === 'assembled' ? 0 : 1
}
