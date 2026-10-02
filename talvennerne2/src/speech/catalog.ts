// The clip catalogue: every fixed spoken sentence has a clip id and its Danish text (SPEC §10.2).
// It doubles as the string table for the child's screens — SpokenText shows clipText(id) and
// speaks the clip. Signatures frozen by the integrator; W3 (speech) implements the catalogue by
// collecting src/speech/clips/**/*.ts (lazily: call loadAllClips() before the first lookup).
//
// A catalogue file is one area (numbers, time, ui/<screen>, skills/<domain> …) owned by one agent:
//
//   // src/speech/clips/ui/shop.ts
//   export const clips = { 's.shop.hello': 'Velkommen i butikken.' }
//   export const wave = 1                  // optional: 1 | 2 | 3 or (id) => 1 | 2 | 3 (default 1)
//   export const pack = 'ui'               // optional: sprite pack, string or (id) => string
//
// `export default { … }` works as well as `export const clips`. Texts are what the screen shows and
// what the voice says. Sentences carry their own final punctuation; fragments carry none — the
// generator adds "," to `.mid` clips and "." to `.end` clips (see generationText()).
// Default packs: files under ui/ → by screen (uiPack below), names/ → 'names-<wave>',
// skills/<domain>… → '<domain>-<wave>', any other file → '<file>-<wave>'.
import type { ClipId } from '../engine/types'

export type Wave = 1 | 2 | 3
export type ClipTable = Readonly<Record<ClipId, string>>

/** The module shape of a catalogue file. */
export interface ClipModule {
  clips?: ClipTable
  default?: ClipTable
  wave?: Wave | ((id: ClipId) => Wave)
  pack?: string | ((id: ClipId) => string)
}

export interface ClipInfo {
  id: ClipId
  text: string
  wave: Wave
  /** Sprite pack the voice pipeline puts the clip in. */
  pack: string
  /** Catalogue file, relative to src/speech/clips/. */
  file: string
}

// Every catalogue file loads lazily, so thousands of sentences and names stay out of the first
// load. loadAllClips() fetches them all: the app awaits it during boot (beside the database), the
// other pages before their first render, and the test setup once. Lookups stay synchronous; before
// the load they know no clip at all.
const loaders = import.meta.glob<ClipModule>(['./clips/**/*.ts', '!./clips/**/*.test.ts'])

let modules: Readonly<Record<string, ClipModule>> | null = null
let loading: Promise<void> | null = null

/** Loads every catalogue file once; resolves when clipText() and friends know all clips. */
export function loadAllClips(): Promise<void> {
  loading ??= Promise.all(Object.entries(loaders).map(async ([path, load]) => [path, await load()] as const)).then((entries) => {
    modules = Object.fromEntries(entries)
    catalogue = null
  })
  return loading
}

/** True once loadAllClips() has finished. */
export function clipsLoaded(): boolean {
  return modules !== null
}

interface Catalogue {
  byId: Map<ClipId, ClipInfo>
  duplicates: { id: ClipId; files: [string, string] }[]
}

let catalogue: Catalogue | null = null
const EMPTY: Catalogue = { byId: new Map(), duplicates: [] }

/**
 * The UI's voice in three steps, for the 1.2 MB of sprites preloaded at start (SPEC §10.4): the first
 * launch, the profiles and the map are preloaded ('ui'); a round's instructions and feedback follow
 * right after in the background ('ui-play'); the books, the shop, the wardrobe and the meadow load on
 * their own, last ('ui-<screen>'). preloadVoice() fetches them in that order.
 */
const UI_PINNED: ReadonlySet<string> = new Set(['soundcheck', 'onboarding', 'profiles', 'gate', 'play', 'ceremony', 'map'])
const UI_PLAY: ReadonlySet<string> = new Set(['round', 'kinds', 'kinds2'])

export function uiPack(screen: string): string {
  if (UI_PINNED.has(screen)) return 'ui'
  if (UI_PLAY.has(screen)) return 'ui-play'
  return `ui-${screen}`
}

function defaultPack(file: string, wave: Wave): string {
  const stem = file.replace(/\.ts$/, '')
  const [top, second] = stem.split('/')
  if (top === 'ui') return uiPack(second ?? '')
  if (top === 'names') return `names-${wave}`
  if (top === 'skills' && second) return `${second}-${wave}`
  return `${stem.replaceAll('/', '-')}-${wave}`
}

function load(): Catalogue {
  if (catalogue) return catalogue
  if (!modules) return EMPTY
  const byId = new Map<ClipId, ClipInfo>()
  const duplicates: Catalogue['duplicates'] = []
  for (const path of Object.keys(modules).sort()) {
    const mod = modules[path]
    const table = mod.clips ?? mod.default
    if (!table) continue
    const file = path.replace(/^\.\/clips\//, '')
    for (const [id, text] of Object.entries(table)) {
      const prior = byId.get(id)
      if (prior) {
        duplicates.push({ id, files: [prior.file, file] })
        continue
      }
      const wave: Wave = typeof mod.wave === 'function' ? mod.wave(id) : (mod.wave ?? 1)
      const pack = typeof mod.pack === 'function' ? mod.pack(id) : (mod.pack ?? defaultPack(file, wave))
      byId.set(id, { id, text, wave, pack, file })
    }
  }
  if (duplicates.length > 0 && import.meta.env?.DEV) {
    console.error('Klip-kataloget har dubletter:', duplicates)
  }
  catalogue = { byId, duplicates }
  return catalogue
}

/** Danish text of a clip (the id itself when unknown, so a missing clip is visible in review). */
export function clipText(id: ClipId): string {
  return load().byId.get(id)?.text ?? id
}

/** True when the clip id is defined in a catalogue file. */
export function hasClip(id: ClipId): boolean {
  return load().byId.has(id)
}

/** Everything the voice pipeline needs about one clip, or undefined when unknown. */
export function clipInfo(id: ClipId): ClipInfo | undefined {
  return load().byId.get(id)
}

/** All clips, sorted by id (scripts/voice/inventory.ts, the listening page, tests). */
export function allClips(): ClipInfo[] {
  return [...load().byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Ids defined in more than one file (a test keeps this empty). */
export function duplicateClips(): readonly { id: ClipId; files: [string, string] }[] {
  return load().duplicates
}

/** Intonation form of a clip, from its id: `.mid` / `.end` segments, `t.half.*`, or none. */
export function clipForm(id: ClipId): 'mid' | 'end' | null {
  if (/(^|\.)mid(\.|$)/.test(id)) return 'mid'
  if (/(^|\.)end(\.|$)/.test(id) || id.startsWith('t.half.')) return 'end'
  return null
}

/**
 * The text the TTS generator reads (SPEC §10.3): `.mid` clips get ",", `.end` clips ".", everything
 * else is read as written (sentences already end in ".", "?" or "!").
 */
export function generationText(id: ClipId): string {
  const text = clipText(id)
  if (/[.?!,]$/.test(text)) return text
  const form = clipForm(id)
  return form === 'mid' ? `${text},` : form === 'end' ? `${text}.` : text
}
