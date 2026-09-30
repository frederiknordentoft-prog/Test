// Planning a spoken sequence of clips (SPEC §10.4–10.5). Pure TypeScript with no DOM or Web Audio,
// so the runtime (voice.ts) and the voice build scripts (scripts/voice/render.ts) schedule
// compositions identically.
//
// Each clip has audible bounds inside its buffer: the first and last sample at or above −45 dBFS.
// The gap between two clips is the silence between the audible end of one and the audible start of
// the next. A clip's source starts PRE_MS before its onset and stops POST_MS after its offset, so
// soft attacks and tails are never cut; neighbouring sources may overlap inside that silence.
import type { ClipId } from '../engine/types'

export const THRESHOLD_DBFS = -45
/** How far fine-tuning may move a nominal start or end (SPEC §10.5: ±60 ms). */
export const SEARCH_MS = 60
/** Audio kept before the onset and after the offset of every clip. */
export const PRE_MS = 4
export const POST_MS = 8

export interface ClipBounds {
  /** Buffer position (ms) of the first sample at or above the threshold. */
  onsetMs: number
  /** Buffer position (ms) just after the last sample at or above the threshold. */
  offsetMs: number
}

export interface PlannedClip {
  id: ClipId
  /** When the source starts, relative to the start of the sequence (ms). */
  startMs: number
  /** Where reading starts in the source buffer (ms). */
  bufferOffsetMs: number
  /** How long the source plays (ms). */
  durMs: number
  /** Audible start and end relative to the start of the sequence (ms). */
  onsetMs: number
  offsetMs: number
}

export interface SequencePlan {
  clips: PlannedClip[]
  /** When the last source stops (ms). */
  totalMs: number
}

export interface PlanOptions {
  preMs?: number
  postMs?: number
}

/**
 * Lays clips out back to back: clip i+1's onset is clip i's offset plus gapsMs[i].
 * `bounds[i]` are the audible bounds of clip i in its buffer.
 */
export function planSequence(
  ids: readonly ClipId[],
  bounds: readonly ClipBounds[],
  gapsMs: readonly number[],
  opts: PlanOptions = {},
): SequencePlan {
  const preMs = opts.preMs ?? PRE_MS
  const postMs = opts.postMs ?? POST_MS
  const clips: PlannedClip[] = []
  let onset = 0
  for (let i = 0; i < ids.length; i++) {
    const b = bounds[i]
    const pre = Math.min(preMs, b.onsetMs)
    if (i === 0) onset = pre
    const audible = Math.max(0, b.offsetMs - b.onsetMs)
    clips.push({
      id: ids[i],
      startMs: onset - pre,
      bufferOffsetMs: b.onsetMs - pre,
      durMs: pre + audible + postMs,
      onsetMs: onset,
      offsetMs: onset + audible,
    })
    onset += audible + (gapsMs[i] ?? 0)
  }
  const lastClip = clips[clips.length - 1]
  return { clips, totalMs: lastClip ? lastClip.startMs + lastClip.durMs : 0 }
}

export interface BoundsOptions {
  /** Silence before the audible start inside the nominal span (manifest `leadMs`, default 20). */
  leadMs?: number
  /** Silence after the audible end inside the nominal span (manifest `tailMs`, default 40). */
  tailMs?: number
  searchMs?: number
  thresholdDbfs?: number
}

/**
 * Finds a clip's audible bounds in decoded audio. `startMs`/`endMs` are the nominal span from the
 * manifest; encoders and decoders shift audio by tens of ms (MP3 priming differs between Safari and
 * Chromium), so the onset is searched within ±60 ms of where it should be, and likewise the offset.
 * Falls back to the nominal bounds when nothing crosses the threshold (a silent clip).
 */
export function findBounds(
  samples: ArrayLike<number>,
  sampleRate: number,
  startMs: number,
  endMs: number,
  opts: BoundsOptions = {},
): ClipBounds {
  const lead = opts.leadMs ?? 20
  const tail = opts.tailMs ?? 40
  const search = opts.searchMs ?? SEARCH_MS
  const threshold = Math.pow(10, (opts.thresholdDbfs ?? THRESHOLD_DBFS) / 20)
  const toIndex = (ms: number) => Math.min(samples.length, Math.max(0, Math.round((ms * sampleRate) / 1000)))
  const toMs = (i: number) => (i * 1000) / sampleRate

  const nominalOnset = startMs + lead
  const nominalOffset = Math.max(nominalOnset, endMs - tail)

  let onsetMs = nominalOnset
  const onFrom = toIndex(startMs - search)
  const onTo = toIndex(Math.min(nominalOnset + search, nominalOffset))
  for (let i = onFrom; i < onTo; i++) {
    if (Math.abs(samples[i]) >= threshold) {
      onsetMs = toMs(i)
      break
    }
  }

  let offsetMs = nominalOffset
  const offFrom = toIndex(endMs + search)
  const offTo = toIndex(Math.max(nominalOffset - search, onsetMs))
  for (let i = offFrom - 1; i >= offTo; i--) {
    if (Math.abs(samples[i]) >= threshold) {
      offsetMs = toMs(i + 1)
      break
    }
  }
  return { onsetMs, offsetMs: Math.max(onsetMs, offsetMs) }
}

/**
 * Mixes a plan into one mono buffer (build scripts render compositions for ASR; tests check
 * timing). `source(id)` returns the samples the clip's bounds refer to.
 */
export function renderSequence(
  plan: SequencePlan,
  source: (id: ClipId) => ArrayLike<number>,
  sampleRate: number,
): Float32Array {
  const out = new Float32Array(Math.ceil((plan.totalMs * sampleRate) / 1000))
  for (const c of plan.clips) {
    const src = source(c.id)
    const at = Math.round((c.startMs * sampleRate) / 1000)
    const from = Math.round((c.bufferOffsetMs * sampleRate) / 1000)
    const n = Math.round((c.durMs * sampleRate) / 1000)
    for (let k = 0; k < n; k++) {
      const j = from + k
      const o = at + k
      if (j >= src.length || o >= out.length) break
      if (j >= 0) out[o] += src[j]
    }
  }
  return out
}
