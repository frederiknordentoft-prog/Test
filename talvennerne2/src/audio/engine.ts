// The one AudioContext for voice and effects (SPEC §10.5):
//   master → destination, voiceBus (1.0) → master, sfxBus (0.7) → master.
// Effects duck to 0.4 while the voice speaks. The context is created lazily at 24 kHz (the voice's
// rate, so decoded sprites take half the memory) and falls back to the device rate.

export interface AudioGraph {
  ctx: AudioContext
  master: GainNode
  voiceBus: GainNode
  sfxBus: GainNode
}

export const VOICE_GAIN = 1
export const SFX_GAIN = 0.7
export const SFX_DUCKED = 0.4
/** Seconds for the duck to settle (setTargetAtTime time constant). */
const DUCK_TC = 0.05

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext

let graph: AudioGraph | null = null
let unavailable = false
let sfxOn = true
let speaking = 0

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function createContext(Ctor: AudioContextCtor): AudioContext | null {
  try {
    return new Ctor({ sampleRate: 24000, latencyHint: 'interactive' })
  } catch {
    // Older WebKit rejects a sample rate it does not run at natively.
  }
  try {
    return new Ctor()
  } catch {
    return null
  }
}

/** The shared audio graph, created on first use; null when Web Audio is missing. */
export function audioGraph(): AudioGraph | null {
  if (graph || unavailable) return graph
  const Ctor = contextCtor()
  const ctx = Ctor ? createContext(Ctor) : null
  if (!ctx) {
    unavailable = true
    return null
  }
  const master = ctx.createGain()
  const voiceBus = ctx.createGain()
  const sfxBus = ctx.createGain()
  master.gain.value = 1
  voiceBus.gain.value = VOICE_GAIN
  sfxBus.gain.value = sfxOn ? SFX_GAIN : 0
  voiceBus.connect(master)
  sfxBus.connect(master)
  master.connect(ctx.destination)
  graph = { ctx, master, voiceBus, sfxBus }
  return graph
}

/** The graph only if it already exists (never creates an AudioContext). */
export function existingAudioGraph(): AudioGraph | null {
  return graph
}

function sfxTarget(): number {
  if (!sfxOn) return 0
  return speaking > 0 ? SFX_DUCKED : SFX_GAIN
}

function applySfxGain(): void {
  if (!graph) return
  const { ctx, sfxBus } = graph
  sfxBus.gain.cancelScheduledValues(ctx.currentTime)
  sfxBus.gain.setTargetAtTime(sfxTarget(), ctx.currentTime, DUCK_TC)
}

/** The voice calls this when an utterance starts and ends; effects are ducked in between. */
export function voiceActivity(active: boolean): void {
  speaking = Math.max(0, speaking + (active ? 1 : -1))
  applySfxGain()
}

/** Parent setting "Lydeffekter". */
export function setSfxEnabled(on: boolean): void {
  sfxOn = on
  applySfxGain()
}

export function sfxEnabled(): boolean {
  return sfxOn
}

/** True when the context exists and is running (unlocked and not interrupted). */
export function audioRunning(): boolean {
  return graph?.ctx.state === 'running'
}
