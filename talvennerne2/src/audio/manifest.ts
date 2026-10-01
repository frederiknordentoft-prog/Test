// voice-manifest.json: where every clip lives in the voice sprites. Written by the voice pipeline
// (scripts/voice/pack.mjs), read by voice.ts. The format is documented in docs/voice-manifest.md.
import type { ClipId } from '../engine/types'

export const MANIFEST_VERSION = 1

export interface VoiceManifest {
  version: 1
  /** Voice id, e.g. 'nic'. */
  voice: string
  /** Sample rate of the encoded sprites (24000). */
  sampleRate: number
  /** Silence kept before the audible start of every clip (ms, default 20). */
  leadMs?: number
  /** Silence kept after the audible end of every clip (ms, default 40). */
  tailMs?: number
  sprites: Record<string, SpriteEntry>
}

export interface SpriteEntry {
  /** File name in src/assets/voice/ (or the URL the resolver maps it to). */
  file: string
  /** Encoded size, for budgets and the diagnosis page. */
  bytes?: number
  /** Length of the whole sprite. */
  durationMs?: number
  /** Loaded at start and never evicted (n0-20, core, ui). */
  pinned?: boolean
  /** Clip id → [start, duration] in ms on the sprite's timeline, lead and tail included. */
  clips: Record<ClipId, [startMs: number, durMs: number]>
}

export interface ManifestIndex {
  manifest: VoiceManifest
  spriteOf: Map<ClipId, string>
  leadMs: number
  tailMs: number
}

/** Validates a manifest and indexes clip → sprite. Throws with a Danish message on bad input. */
export function indexManifest(manifest: VoiceManifest): ManifestIndex {
  if (!manifest || manifest.version !== MANIFEST_VERSION || typeof manifest.sprites !== 'object') {
    throw new Error('voice-manifest.json: ukendt format')
  }
  const spriteOf = new Map<ClipId, string>()
  for (const [sprite, entry] of Object.entries(manifest.sprites)) {
    if (!entry.file || typeof entry.clips !== 'object') throw new Error(`voice-manifest.json: sprite ${sprite} mangler file/clips`)
    for (const [id, span] of Object.entries(entry.clips)) {
      if (!Array.isArray(span) || span.length !== 2 || !(span[1] > 0)) throw new Error(`voice-manifest.json: ${id} har en ugyldig placering`)
      if (spriteOf.has(id)) throw new Error(`voice-manifest.json: ${id} findes i to sprites`)
      spriteOf.set(id, sprite)
    }
  }
  return { manifest, spriteOf, leadMs: manifest.leadMs ?? 20, tailMs: manifest.tailMs ?? 40 }
}
