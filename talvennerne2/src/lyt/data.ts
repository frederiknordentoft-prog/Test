// Data for the listening page: the voice manifest (which clip lives in which sprite), the pipeline's
// QA per clip (ASR text, CER, LUFS from voice/masters/index.json, copied by scripts/voice/pack.mjs)
// and the reviewer's flags. Flags live in localStorage under talvennerne2.lyt-flags, always through
// src/data/namespace.ts.
import type { VoiceManifest } from '../audio/manifest'
import { LYT_FLAGS_KEY, localGetJson, localSetJson } from '../data/namespace'

const manifestLoaders = import.meta.glob<VoiceManifest>('../assets/voice/voice-manifest.json', { import: 'default' })
const qaUrls = import.meta.glob<string>('../assets/voice/voice-qa.json', { eager: true, query: '?url', import: 'default' })

export interface ClipQa {
  asr: string | null
  /** The text ASR was compared with (the clip alone, its carrier sentence or a composition). */
  expected: string | null
  cer: number | null
  lufs: number | null
  dur: number | null
  take: number
  takes: number
  pass: boolean
  /** alone | carrier | comp | none */
  check: string | null
  method: string | null
  engine: string | null
}

export interface VoiceQa {
  voice: string
  clips: Record<string, ClipQa>
}

export async function loadManifest(): Promise<VoiceManifest | null> {
  const load = Object.values(manifestLoaders)[0]
  if (!load) return null
  try {
    return await load()
  } catch {
    return null
  }
}

export async function loadQa(): Promise<VoiceQa | null> {
  const url = Object.values(qaUrls)[0]
  if (!url) return null
  try {
    const res = await fetch(url)
    return res.ok ? ((await res.json()) as VoiceQa) : null
  } catch {
    return null
  }
}

// ─── Flags ──────────────────────────────────────────────────────────────────

export interface Flag {
  /** The take that was flagged, so a regenerated clip is not mistaken for the flagged one. */
  take: number | null
  at: string
  note?: string
}

export interface FlagStore {
  v: 1
  flags: Record<string, Flag>
}

const isFlagStore = (v: unknown): v is FlagStore =>
  typeof v === 'object' && v !== null && (v as FlagStore).v === 1 && typeof (v as FlagStore).flags === 'object' && (v as FlagStore).flags !== null

export function readFlags(): FlagStore {
  return localGetJson<FlagStore>(LYT_FLAGS_KEY, { v: 1, flags: {} }, isFlagStore)
}

/** Toggles a flag and returns the new store (also when storage is unavailable). */
export function toggleFlag(store: FlagStore, id: string, take: number | null, at: string): FlagStore {
  const flags = { ...store.flags }
  if (flags[id]) delete flags[id]
  else flags[id] = { take, at }
  const next: FlagStore = { v: 1, flags }
  localSetJson(LYT_FLAGS_KEY, next)
  return next
}

export function setNote(store: FlagStore, id: string, note: string): FlagStore {
  const flag = store.flags[id]
  if (!flag) return store
  const next: FlagStore = { v: 1, flags: { ...store.flags, [id]: { ...flag, note: note || undefined } } }
  localSetJson(LYT_FLAGS_KEY, next)
  return next
}

/** The export a reviewer sends back: one row per flagged clip with its text and take. */
export function exportFlags(store: FlagStore, text: (id: string) => string, voice: string | null, at: string): string {
  const rows = Object.entries(store.flags)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, f]) => ({ id, text: text(id), take: f.take, at: f.at, ...(f.note ? { note: f.note } : {}) }))
  return JSON.stringify({ voice, exported: at, flags: rows }, null, 1)
}
