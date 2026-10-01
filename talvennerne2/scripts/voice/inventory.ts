// The clip inventory (SPEC §10.2): every clip in the catalogue with the text the generator reads and
// a hash that decides whether its master is up to date. Generated from the code, never by hand:
//
//   node scripts/voice/run-vite.mjs scripts/voice/inventory.ts      → voice/inventory.json
//
// hash = sha1(genText | voice | settings | modelRev). `settings` is the generator settings plus the
// pipeline version from voice/config.json as canonical JSON, so changing a setting, the voice, the
// model revision or the pipeline regenerates exactly the clips it affects. scripts/tts/generate.py
// is idempotent on this hash.
//
// Besides the contract fields {id, text, genText, pack, wave, hash} every entry carries what the
// Python side needs to compose clips the way the runtime does without reimplementing the catalogue
// rules: the intonation form, the clip class that decides the silence after it, and whether it
// opens a sentence (src/speech/compile.ts).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as catalog from '../../src/speech/catalog'
import { allClips, clipForm, generationText, type ClipInfo } from '../../src/speech/catalog'
import { clipClass, startsSentence, type ClipClass } from '../../src/speech/compile'

export const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const CONFIG_PATH = path.join(APP_ROOT, 'voice/config.json')
export const INVENTORY_PATH = path.join(APP_ROOT, 'voice/inventory.json')

export interface VoiceConfig {
  voice: string
  modelRepo: string
  modelRev: string
  prompt: string
  settings: Record<string, string | number>
  pipeline: string
}

export interface InventoryClip {
  id: string
  /** What the screen shows (catalogue text). */
  text: string
  /** What the generator reads: the text with the form's punctuation (generationText()). */
  genText: string
  pack: string
  wave: 1 | 2 | 3
  hash: string
  form: 'mid' | 'end' | null
  /** Decides the silence after the clip in a composition (compile.ts clipClass). */
  cls: ClipClass
  /** True when the clip opens a sentence (compile.ts startsSentence). */
  opens: boolean
  /** Catalogue file, relative to src/speech/clips/. */
  file: string
}

export interface Inventory {
  version: 1
  voice: string
  modelRev: string
  settings: string
  configSha1: string
  count: number
  clips: InventoryClip[]
}

const sha1 = (s: string | Buffer) => createHash('sha1').update(s).digest('hex')

/** The catalogue loads lazily: call this before using it outside the app and the test setup. */
export async function ensureCatalog(): Promise<void> {
  await catalog.loadAllClips()
}

export function readConfig(file = CONFIG_PATH): { config: VoiceConfig; sha1: string } {
  const raw = readFileSync(file)
  return { config: JSON.parse(raw.toString('utf8')) as VoiceConfig, sha1: sha1(raw) }
}

/** Canonical JSON (sorted keys) of the generator settings and the pipeline version. */
export function settingsKey(config: VoiceConfig): string {
  const all: Record<string, string | number> = { ...config.settings, pipeline: config.pipeline }
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]))
  return JSON.stringify(sorted)
}

export function clipHash(genText: string, config: VoiceConfig): string {
  return sha1(`${genText}|${config.voice}|${settingsKey(config)}|${config.modelRev}`)
}

export function inventoryClip(c: ClipInfo, config: VoiceConfig): InventoryClip {
  const genText = generationText(c.id)
  return {
    id: c.id,
    text: c.text,
    genText,
    pack: c.pack,
    wave: c.wave,
    hash: clipHash(genText, config),
    form: clipForm(c.id),
    cls: clipClass(c.id),
    opens: startsSentence(c.id),
    file: c.file,
  }
}

export function buildInventory(clips: readonly ClipInfo[], config: VoiceConfig, configSha1: string): Inventory {
  const list = clips.map((c) => inventoryClip(c, config)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    version: 1,
    voice: config.voice,
    modelRev: config.modelRev,
    settings: settingsKey(config),
    configSha1,
    count: list.length,
    clips: list,
  }
}

/** One clip per line, so a changed text shows up as a one-line diff. */
export function formatInventory(inv: Inventory): string {
  const { clips, ...head } = inv
  const headJson = JSON.stringify(head, null, 2).replace(/\n}$/, '')
  return `${headJson},\n  "clips": [\n${clips.map((c) => `    ${JSON.stringify(c)}`).join(',\n')}\n  ]\n}\n`
}

export async function main(args: string[]): Promise<number> {
  await ensureCatalog()
  const out = args[0] ? path.resolve(APP_ROOT, args[0]) : INVENTORY_PATH
  const { config, sha1: configSha1 } = readConfig()
  const inv = buildInventory(allClips(), config, configSha1)
  if (inv.count === 0) throw new Error('klip-kataloget er tomt (blev det indlæst?)')
  writeFileSync(out, formatInventory(inv))
  const waves = new Map<number, number>()
  const packs = new Map<string, number>()
  for (const c of inv.clips) {
    waves.set(c.wave, (waves.get(c.wave) ?? 0) + 1)
    packs.set(c.pack, (packs.get(c.pack) ?? 0) + 1)
  }
  const waveText = [...waves].sort().map(([w, n]) => `bølge ${w}: ${n}`).join(', ')
  console.log(`inventar: ${inv.count} klip (${waveText}), ${packs.size} pakker → ${path.relative(APP_ROOT, out)}`)
  return 0
}
