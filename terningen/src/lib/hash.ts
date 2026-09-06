import { isComponentId, type ComponentId } from '../content/model'
import { beatForComponent, isValidBeat, resolveBeat, type Stage } from './beats'

export type ModelState = {
  stage: Stage
  openComponent: ComponentId | null
  bottleneck: ComponentId | null
  beat: number // 0 = samlet, 1 = eksploderet, 2..8 = komponenter
}

export const INITIAL_STATE: ModelState = {
  stage: 'assembled',
  openComponent: null,
  bottleneck: null,
  beat: 0,
}

const KEY_BEAT = 'beat'
const KEY_OPEN = 'open'
const KEY_BOTTLENECK = 'bottleneck'
const KNOWN_KEYS = new Set([KEY_BEAT, KEY_OPEN, KEY_BOTTLENECK])

/**
 * `#beat=4&open=teknologi&bottleneck=governance`
 * Rækkefølgen er fast, så serialize(parse(h)) === h for gyldige hashes.
 */
export function serializeHash(state: ModelState): string {
  const parts = [`${KEY_BEAT}=${state.beat}`]
  if (state.openComponent) parts.push(`${KEY_OPEN}=${state.openComponent}`)
  if (state.bottleneck) parts.push(`${KEY_BOTTLENECK}=${state.bottleneck}`)
  return `#${parts.join('&')}`
}

/**
 * Parser en URL-hash til en konsistent ModelState.
 * Alt ugyldigt (ukendt nøgle, ukendt komponent, beat uden for 0..8,
 * beat/open der modsiger hinanden) falder tilbage til INITIAL_STATE — aldrig et crash.
 */
export function parseHash(hash: string | null | undefined): ModelState {
  if (!hash) return { ...INITIAL_STATE }
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (raw.trim() === '') return { ...INITIAL_STATE }

  let params: URLSearchParams
  try {
    params = new URLSearchParams(raw)
  } catch {
    return { ...INITIAL_STATE }
  }

  for (const key of params.keys()) {
    if (!KNOWN_KEYS.has(key)) return { ...INITIAL_STATE }
  }

  const beatRaw = params.get(KEY_BEAT)
  const openRaw = params.get(KEY_OPEN)
  const bottleneckRaw = params.get(KEY_BOTTLENECK)

  let beat = 0
  if (beatRaw !== null) {
    if (!/^\d+$/.test(beatRaw)) return { ...INITIAL_STATE }
    const n = Number(beatRaw)
    if (!isValidBeat(n)) return { ...INITIAL_STATE }
    beat = n
  }

  let open: ComponentId | null = null
  if (openRaw !== null) {
    if (!isComponentId(openRaw)) return { ...INITIAL_STATE }
    open = openRaw
    // `open` uden `beat` er et gyldigt deep-link; med begge skal de stemme overens.
    if (beatRaw === null) beat = beatForComponent(open)
    else if (beatForComponent(open) !== beat) return { ...INITIAL_STATE }
  }

  let bottleneck: ComponentId | null = null
  if (bottleneckRaw !== null) {
    if (!isComponentId(bottleneckRaw)) return { ...INITIAL_STATE }
    bottleneck = bottleneckRaw
  }

  const resolved = resolveBeat(beat)
  return {
    stage: resolved.stage,
    openComponent: resolved.openComponent,
    bottleneck,
    beat: resolved.beat,
  }
}

export function statesEqual(a: ModelState, b: ModelState): boolean {
  return (
    a.stage === b.stage &&
    a.openComponent === b.openComponent &&
    a.bottleneck === b.bottleneck &&
    a.beat === b.beat
  )
}
