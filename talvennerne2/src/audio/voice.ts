// Spoken output (SPEC §10.5). The signatures are frozen by the integrator: screens and SpokenText
// call `speak()`; W3 (speech/audio) implements the pre-recorded voice engine here.
//
// speak(parts) compiles the parts to clips (src/speech/compile.ts), makes sure the sprites holding
// them are decoded, and schedules the clips gapless on the voice bus (src/audio/sequence.ts). If a
// clip has no recording, or its sprite is not ready 800 ms after the call, the whole statement is
// read by the device voice instead — one statement is never spoken in two voices. Free text (a
// child's name) is its own utterance for the device voice.
//
// Sprites load on demand (fetch + decodeAudioData). Clip bounds are fine-tuned ±60 ms to −45 dBFS
// after decoding. Decoded audio is kept in an LRU of 64 MB, of which pinned sprites (n0-20, core,
// ui) may take 24 MB.
//
// Test hook: with `?e2e=1` in the URL, `window.__voiceLog` lists every clip id spoken; `&voice=fast`
// additionally makes silent speech end after 20 ms instead of its planned duration.
import type { ClipId, SpeechPart } from '../engine/types'
import { GAP_MS, compile, type Compiled } from '../speech/compile'
import { ttsCancel, ttsSpeak, type TtsHandle } from './deviceTts'
import { decodeContext, existingAudioGraph, voiceActivity } from './engine'
import { indexManifest, type ManifestIndex, type VoiceManifest } from './manifest'
import { POST_MS, PRE_MS, findBounds, planSequence, type ClipBounds, type SequencePlan } from './sequence'
import { installAudioUnlock } from './unlock'

export interface SpeakHandle {
  /** Resolves at the scheduled end — also when the device is muted — so answer timers can start. */
  ended: Promise<void>
  /** Fades the voice out within ~30 ms. A new task or answer always cancels what is playing. */
  cancel(): void
  /** Planned duration in ms (0 when unknown). */
  durationMs: number
}

export interface SpeakOptions {
  /** Cancel whatever is playing first (default true). */
  interrupt?: boolean
}

/** A sprite not decoded this long after speak() sends the statement to the device voice. */
export const FALLBACK_AFTER_MS = 800
export const LRU_LIMIT_BYTES = 64 * 1024 * 1024
export const PINNED_LIMIT_BYTES = 24 * 1024 * 1024
/** Scheduling lead so the first source starts sample-accurately. */
const LOOKAHEAD_S = 0.03
const FADE_S = 0.03

// ─── Manifest and sprite files ─────────────────────────────────────────────

// The manifest is data: a JSON file fetched when the voice is first needed, not a JS chunk (it grows
// with every clip, and JSON.parse is cheaper than a module; SPEC §12's JS budget). Both globs are
// empty until the voice is packed.
const manifestUrls = import.meta.glob<string>('../assets/voice/voice-manifest.json', { eager: true, query: '?url', import: 'default' })
const spriteUrls = import.meta.glob<string>('../assets/voice/*.mp3', { eager: true, query: '?url', import: 'default' })

type UrlResolver = (file: string) => string | undefined

const defaultResolver: UrlResolver = (file) => spriteUrls[`../assets/voice/${file}`]

let resolveUrl: UrlResolver = defaultResolver
let manifestSource: (() => Promise<VoiceManifest | null>) | null = null
let indexPromise: Promise<ManifestIndex | null> | null = null
let index: ManifestIndex | null = null

function loadIndex(): Promise<ManifestIndex | null> {
  if (!indexPromise) {
    const source =
      manifestSource ??
      (async () => {
        const url = Object.values(manifestUrls)[0]
        if (!url) return null
        const res = await fetch(url)
        return res.ok ? ((await res.json()) as VoiceManifest) : null
      })
    indexPromise = source().then(
      (m) => {
        try {
          index = m ? indexManifest(m) : null
        } catch (err) {
          console.error(err)
          index = null
        }
        return index
      },
      () => null,
    )
  }
  return indexPromise
}

/**
 * Points the voice at another manifest and sprite location (tests, the timing page, the
 * listening page). `manifest: null` means "no recordings": everything uses the device voice.
 */
export function configureVoice(opts: { manifest: VoiceManifest | null; resolveUrl?: UrlResolver }): void {
  hush()
  const m = opts.manifest
  manifestSource = () => Promise.resolve(m)
  resolveUrl = opts.resolveUrl ?? defaultResolver
  indexPromise = null
  index = null
  sprites.clear()
}

// ─── Sprite cache ───────────────────────────────────────────────────────────

interface Sprite {
  id: string
  state: 'loading' | 'ready' | 'error'
  promise: Promise<Sprite>
  buffer: AudioBuffer | null
  bounds: Map<ClipId, ClipBounds>
  bytes: number
  pinned: boolean
  lastUsed: number
  inUse: number
}

const sprites = new Map<string, Sprite>()

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // The callback form works on every WebKit; newer engines also return a promise.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined
    p?.then(resolve, reject)
  })
}

function decodedBytes(filter: (s: Sprite) => boolean = () => true): number {
  let total = 0
  for (const s of sprites.values()) if (s.state === 'ready' && filter(s)) total += s.bytes
  return total
}

function evict(): void {
  while (decodedBytes() > LRU_LIMIT_BYTES) {
    let victim: Sprite | null = null
    for (const s of sprites.values()) {
      if (s.state !== 'ready' || s.pinned || s.inUse > 0) continue
      if (!victim || s.lastUsed < victim.lastUsed) victim = s
    }
    if (!victim) return
    sprites.delete(victim.id)
  }
}

function loadSprite(id: string): Promise<Sprite> {
  const known = sprites.get(id)
  if (known && known.state !== 'error') return known.promise
  const sprite: Sprite = {
    id, state: 'loading', promise: Promise.resolve(null as unknown as Sprite), buffer: null, bounds: new Map(),
    bytes: 0, pinned: false, lastUsed: performance.now(), inUse: 0,
  }
  sprite.promise = (async () => {
    const idx = await loadIndex()
    const entry = idx?.manifest.sprites[id]
    const decoder = decodeContext()
    const url = entry ? resolveUrl(entry.file) : undefined
    if (!entry || !decoder || !url) throw new Error(`stemme-sprite ${id} kan ikke hentes`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`stemme-sprite ${id}: HTTP ${res.status}`)
    const buffer = await decode(decoder, await res.arrayBuffer())
    sprite.buffer = buffer
    sprite.bytes = buffer.length * buffer.numberOfChannels * 4
    sprite.pinned = !!entry.pinned && decodedBytes((s) => s.pinned) + sprite.bytes <= PINNED_LIMIT_BYTES
    sprite.state = 'ready'
    evict()
    return sprite
  })().catch((err: unknown) => {
    sprite.state = 'error'
    sprites.delete(id)
    throw err
  })
  sprites.set(id, sprite)
  return sprite.promise
}

function boundsFor(sprite: Sprite, id: ClipId, idx: ManifestIndex): ClipBounds {
  const cached = sprite.bounds.get(id)
  if (cached) return cached
  const [start, dur] = idx.manifest.sprites[sprite.id].clips[id]
  const buffer = sprite.buffer!
  const b = findBounds(buffer.getChannelData(0), buffer.sampleRate, start, start + dur, { leadMs: idx.leadMs, tailMs: idx.tailMs })
  sprite.bounds.set(id, b)
  return b
}

/** Planned length from the manifest alone (before decoding): audible spans plus gaps. */
function nominalMs(compiled: Compiled, idx: ManifestIndex): number {
  let total = 0
  compiled.utterances.forEach((u, i) => {
    if (i > 0) total += GAP_MS.sentence
    if (u.kind === 'free') return
    u.clips.forEach((id, k) => {
      const sprite = idx.spriteOf.get(id)
      const span = sprite ? idx.manifest.sprites[sprite].clips[id] : undefined
      total += span ? Math.max(0, span[1] - idx.leadMs - idx.tailMs) : 0
      total += u.gapsMs[k] ?? 0
    })
    total += PRE_MS + POST_MS
  })
  return Math.round(total)
}

// ─── Settings and test hooks ────────────────────────────────────────────────

let speechOn = true

/** Parent setting "Oplæsning". Off: speak() is silent and ends at once. */
export function setSpeechEnabled(on: boolean): void {
  speechOn = on
  if (!on) hush()
}

export function speechEnabled(): boolean {
  return speechOn
}

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null
const e2e = params?.get('e2e') === '1'
const fastSilence = e2e && params?.get('voice') === 'fast'

declare global {
  interface Window {
    __voiceLog?: string[]
  }
}

if (e2e && typeof window !== 'undefined') window.__voiceLog = window.__voiceLog ?? []

function logClips(compiled: Compiled): void {
  if (e2e && typeof window !== 'undefined') window.__voiceLog?.push(...compiled.clips)
}

export interface PlannedSpeech {
  /** AudioContext time of the sequence start (s). */
  ctxStart: number
  plan: SequencePlan
  sampleRate: number
}

let lastPlan: PlannedSpeech | null = null

/** The last scheduled clip sequence (timing tests and the diagnosis page). */
export function debugLastPlan(): PlannedSpeech | null {
  return lastPlan
}

// ─── Speaking ───────────────────────────────────────────────────────────────

class Speech implements SpeakHandle {
  readonly ended: Promise<void>
  private resolveEnded!: () => void
  private done = false
  private cancelled = false
  private sources: AudioBufferSourceNode[] = []
  private gain: GainNode | null = null
  private tts: TtsHandle | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private held: Sprite[] = []
  private voiceOn = false
  private planned = 0

  constructor(
    private readonly compiled: Compiled,
    private readonly after: Speech | null,
    private readonly calledAt: number,
  ) {
    this.ended = new Promise((resolve) => {
      this.resolveEnded = resolve
    })
    if (index) this.planned = nominalMs(compiled, index)
  }

  get durationMs(): number {
    return this.planned
  }

  get finished(): boolean {
    return this.done
  }

  cancel(): void {
    if (this.done) return
    this.cancelled = true
    const graph = existingAudioGraph()
    if (this.gain && graph) {
      const t = graph.ctx.currentTime
      const g = this.gain.gain
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0, t + FADE_S)
      for (const src of this.sources) {
        try {
          src.stop(t + FADE_S + 0.005)
        } catch {
          // already stopped
        }
      }
      const gain = this.gain
      setTimeout(() => gain.disconnect(), 200)
    }
    this.tts?.cancel()
    this.finish()
  }

  private finish(): void {
    if (this.done) return
    this.done = true
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    if (this.voiceOn) voiceActivity(false)
    this.voiceOn = false
    for (const s of this.held) s.inUse--
    this.held = []
    this.resolveEnded()
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.timers.delete(t)
        resolve()
      }, Math.max(0, ms))
      this.timers.add(t)
    })
  }

  async run(): Promise<void> {
    try {
      if (this.after) await this.after.ended
      if (this.cancelled) return
      const deadline = Math.max(this.calledAt + FALLBACK_AFTER_MS, performance.now())
      const idx = await Promise.race([loadIndex(), this.wait(deadline - performance.now()).then(() => null)])
      if (this.cancelled) return
      const clipIds = this.compiled.utterances.flatMap((u) => (u.kind === 'clips' ? u.clips : []))
      if (!idx || clipIds.some((id) => !idx.spriteOf.has(id))) return await this.readWhole()
      this.planned = nominalMs(this.compiled, idx)
      const needed = [...new Set(clipIds.map((id) => idx.spriteOf.get(id)!))]
      const ready = await Promise.race([
        Promise.all(needed.map(loadSprite)).then(
          (list) => list,
          () => null,
        ),
        this.wait(deadline - performance.now()).then(() => null),
      ])
      if (this.cancelled) return
      if (!ready) return await this.readWhole()
      for (const s of ready) {
        s.inUse++
        s.lastUsed = performance.now()
        this.held.push(s)
      }
      for (let i = 0; i < this.compiled.utterances.length; i++) {
        const u = this.compiled.utterances[i]
        if (i > 0) await this.wait(GAP_MS.sentence)
        if (this.cancelled) return
        if (u.kind === 'clips') await this.playClips(u.clips, u.gapsMs, idx)
        else await this.readFree(u.text)
        if (this.cancelled) return
      }
    } catch (err) {
      console.error(err)
    } finally {
      this.finish()
    }
  }

  /** The whole statement in the device voice (missing clip or sprite too late). */
  private async readWhole(): Promise<void> {
    if (fastSilence) return this.wait(20)
    this.tts = ttsSpeak(this.compiled.text)
    this.planned = this.tts.estimatedMs
    this.markVoice()
    await this.tts.ended
  }

  private async readFree(text: string): Promise<void> {
    if (fastSilence) return this.wait(20)
    this.tts = ttsSpeak(text)
    this.markVoice()
    await this.tts.ended
  }

  private markVoice(): void {
    if (this.voiceOn) return
    this.voiceOn = true
    voiceActivity(true)
  }

  private async playClips(ids: ClipId[], gapsMs: number[], idx: ManifestIndex): Promise<void> {
    // Only a gesture creates the live context (unlock.ts); until then speech is silent but timed.
    const graph = existingAudioGraph()
    const bufferOf = (id: ClipId) => sprites.get(idx.spriteOf.get(id)!)!
    const bounds = ids.map((id) => boundsFor(bufferOf(id), id, idx))
    const plan = planSequence(ids, bounds, gapsMs)
    if (!graph) return this.wait(fastSilence ? 20 : plan.totalMs)
    const { ctx } = graph
    if (ctx.state !== 'running') {
      await Promise.race([ctx.resume().catch(() => undefined), this.wait(150)])
      if (this.cancelled) return
    }
    if (ctx.state !== 'running') {
      // Locked or interrupted: nothing can sound, but the statement still takes its time.
      return this.wait(fastSilence ? 20 : plan.totalMs)
    }
    const gain = ctx.createGain()
    gain.connect(graph.voiceBus)
    this.gain = gain
    const ctxStart = ctx.currentTime + LOOKAHEAD_S
    for (const c of plan.clips) {
      const src = ctx.createBufferSource()
      src.buffer = bufferOf(c.id).buffer
      src.connect(gain)
      src.start(ctxStart + c.startMs / 1000, c.bufferOffsetMs / 1000, c.durMs / 1000)
      this.sources.push(src)
    }
    this.markVoice()
    lastPlan = { ctxStart, plan, sampleRate: ctx.sampleRate }
    this.planned = plan.totalMs
    // The planned end is heard one output latency after the context reaches it.
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0
    await this.wait((ctxStart + plan.totalMs / 1000 - ctx.currentTime + latency) * 1000)
    setTimeout(() => gain.disconnect(), 100)
    this.gain = null
    this.sources = []
  }
}

let current: Speech | null = null
const queue = new Set<Speech>()

/** Speaks the parts; cancels what is playing unless `interrupt: false`, which queues after it. */
export function speak(parts: SpeechPart[], opts: SpeakOptions = {}): SpeakHandle {
  const compiled = compile(parts)
  logClips(compiled)
  if (!speechOn || compiled.utterances.length === 0) {
    return { ended: Promise.resolve(), cancel() {}, durationMs: 0 }
  }
  const interrupt = opts.interrupt !== false
  if (interrupt) hush()
  const previous = !interrupt && current && !current.finished ? current : null
  const speech = new Speech(compiled, previous, performance.now())
  current = speech
  queue.add(speech)
  void speech.ended.then(() => {
    queue.delete(speech)
    if (current === speech) current = null
  })
  void speech.run()
  return speech
}

/** Stop all speech. */
export function hush(): void {
  for (const s of [...queue]) s.cancel()
  queue.clear()
  current = null
  ttsCancel()
}

// ─── Preloading and status ─────────────────────────────────────────────────

/** The order the UI's other sprites are fetched in after the pinned ones: a round's lines first. */
const LATER_UI = (id: string): number => (id.startsWith('ui-play') ? 0 : id.startsWith('rewards') ? 1 : id.startsWith('ui-') ? 2 : -1)

/**
 * Loads the manifest and the pinned sprites (call in idle after the first render), then the rest of
 * the UI's voice in the background, one sprite at a time, so the screens a child opens later speak in
 * the recorded voice from the first line (catalog.ts, uiPack).
 */
export async function preloadVoice(): Promise<void> {
  const idx = await loadIndex()
  if (!idx) return
  const entries = Object.entries(idx.manifest.sprites)
  const pinned = entries.filter(([, e]) => e.pinned).map(([id]) => id)
  await Promise.all(pinned.map((id) => loadSprite(id).catch(() => undefined)))
  const later = entries
    .filter(([id, e]) => !e.pinned && LATER_UI(id) >= 0)
    .map(([id]) => id)
    .sort((a, b) => LATER_UI(a) - LATER_UI(b) || a.localeCompare(b))
  for (const id of later) await loadSprite(id).catch(() => undefined)
}

/** Loads every sprite the given statements need (a round's tasks, during the 1.2 s intro). */
export async function preloadSpeech(statements: readonly SpeechPart[][]): Promise<void> {
  const idx = await loadIndex()
  if (!idx) return
  const ids = new Set<string>()
  for (const parts of statements) {
    for (const id of compile(parts).clips) {
      const sprite = idx.spriteOf.get(id)
      if (sprite) ids.add(sprite)
    }
  }
  await Promise.all([...ids].map((id) => loadSprite(id).catch(() => undefined)))
}

export interface VoiceStatus {
  manifest: 'loading' | 'none' | 'ready'
  voice: string | null
  clips: number
  sprites: { id: string; state: Sprite['state'] | 'idle'; bytes: number; pinned: boolean }[]
  decodedBytes: number
  pinnedBytes: number
}

/** A snapshot for the diagnosis and listening pages. */
export function voiceStatus(): VoiceStatus {
  const idx = index
  const ids = idx ? Object.keys(idx.manifest.sprites) : []
  return {
    manifest: indexPromise === null ? 'loading' : idx ? 'ready' : 'none',
    voice: idx?.manifest.voice ?? null,
    clips: idx?.spriteOf.size ?? 0,
    sprites: ids.map((id) => {
      const s = sprites.get(id)
      return { id, state: s?.state ?? 'idle', bytes: s?.bytes ?? 0, pinned: s?.pinned ?? false }
    }),
    decodedBytes: decodedBytes(),
    pinnedBytes: decodedBytes((s) => s.pinned),
  }
}

/** Resolves once the manifest question is settled (true when recordings exist). */
export async function voiceAvailable(): Promise<boolean> {
  return (await loadIndex()) !== null
}

if (typeof document !== 'undefined') {
  // speak() is the UI's only way to sound, so importing it installs the tap-to-unlock listeners.
  installAudioUnlock()
  // Nothing should keep talking behind the home screen; the round re-speaks after "Tryk for at fortsætte".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hush()
  })
}
